begin;

create table public.categories (
  slug text primary key,
  name text not null,
  is_virtual boolean not null default false
);

insert into public.categories (slug, name, is_virtual) values
  ('arithmetic', 'Arithmetic', false),
  ('algebra', 'Algebra', false),
  ('geometry', 'Geometry', false),
  ('mixed', 'Mixed', true);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  avatar_url text,
  role text not null default 'player' check (role in ('player', 'admin')),
  created_at timestamptz not null default now()
);

create table public.ratings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null references public.categories (slug) on delete restrict,
  rating double precision not null default 1500 check (rating >= 0),
  rd double precision not null default 350 check (rd >= 0),
  vol double precision not null default 0.06 check (vol >= 0),
  games_played integer not null default 0 check (games_played >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  category text not null references public.categories (slug) on delete restrict,
  body text not null,
  type text not null check (type in ('multiple_choice', 'numeric')),
  choices jsonb,
  correct_answer text not null,
  accepted_answers text[] not null default '{}',
  tolerance double precision not null default 0 check (tolerance >= 0),
  explanation text not null default '',
  image_url text,
  difficulty double precision not null default 1500,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  body_hash text not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint questions_choices_match_type check (
    case when type = 'multiple_choice' then
      jsonb_typeof(choices) = 'array'
      and jsonb_array_length(case when jsonb_typeof(choices) = 'array' then choices else '[]'::jsonb end) between 2 and 6
    else choices is null end
  )
);

create index questions_category_status_difficulty_idx
  on public.questions (category, status, difficulty);

create function public.validate_question_category()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  category_is_virtual boolean;
begin
  select is_virtual into category_is_virtual
  from public.categories
  where slug = new.category;

  if coalesce(category_is_virtual, true) then
    raise exception 'questions_require_physical_category' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger questions_require_physical_category
  before insert or update on public.questions
  for each row execute function public.validate_question_category();

create table public.games (
  id uuid primary key default gen_random_uuid(),
  category text not null references public.categories (slug) on delete restrict,
  preset text not null,
  question_count integer not null check (question_count > 0),
  seconds_per_question integer not null check (seconds_per_question > 0),
  status text not null default 'active' check (status in ('active', 'finished', 'abandoned')),
  player_a uuid not null references public.profiles (id) on delete restrict,
  player_b uuid references public.profiles (id) on delete restrict,
  is_bot boolean not null default false,
  bot_display_name text,
  bot_display_rating integer,
  current_position integer not null default 0 check (current_position >= 0),
  question_started_at timestamptz,
  winner text check (winner in ('a', 'b', 'draw')),
  score_a integer check (score_a >= 0),
  score_b integer check (score_b >= 0),
  rating_a_before double precision,
  rating_a_after double precision,
  rating_b_before double precision,
  rating_b_after double precision,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint games_opponent_matches_type check (
    (is_bot and player_b is null) or (not is_bot and player_b is not null)
  )
);

create table public.game_questions (
  game_id uuid not null references public.games (id) on delete cascade,
  position integer not null check (position >= 0),
  question_id uuid not null references public.questions (id) on delete restrict,
  primary key (game_id, position)
);

create table public.game_moves (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null,
  position integer not null check (position >= 0),
  side text not null check (side in ('a', 'b')),
  answer_given text,
  is_correct boolean not null,
  time_taken_ms integer not null check (time_taken_ms >= 0),
  answered_at timestamptz not null default now(),
  unique (game_id, position, side),
  foreign key (game_id, position) references public.game_questions (game_id, position) on delete cascade
);

create table public.game_bot_plans (
  game_id uuid primary key references public.games (id) on delete cascade,
  plan jsonb not null,
  bot_rating_used double precision not null
);

create table public.matchmaking_queue (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  category text not null references public.categories (slug) on delete cascade,
  rating double precision not null,
  joined_at timestamptz not null default now(),
  matched_game_id uuid references public.games (id) on delete set null,
  bot_after_ms integer not null check (bot_after_ms >= 0)
);

create index matchmaking_queue_waiting_idx
  on public.matchmaking_queue (category, joined_at)
  where matched_game_id is null;

create table public.rating_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null references public.categories (slug) on delete restrict,
  game_id uuid not null references public.games (id) on delete cascade,
  rating_before double precision not null,
  rating_after double precision not null,
  rd_after double precision not null,
  created_at timestamptz not null default now()
);

create index rating_history_user_category_created_idx
  on public.rating_history (user_id, category, created_at);

create index games_player_a_created_idx on public.games (player_a, created_at desc);
create index games_player_b_created_idx on public.games (player_b, created_at desc);

create function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  requested_username text;
  email_prefix text;
  candidate_username text;
begin
  requested_username := nullif(lower(btrim(new.raw_user_meta_data ->> 'username')), '');

  if requested_username is null then
    email_prefix := left(regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g'), 12);
    if length(email_prefix) < 3 then
      email_prefix := 'player';
    end if;

    loop
      candidate_username := email_prefix || '_' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      exit when not exists (
        select 1 from public.profiles where username = candidate_username
      );
    end loop;
    requested_username := candidate_username;
  end if;

  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    requested_username,
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  );

  insert into public.ratings (user_id, category)
  select new.id, slug from public.categories;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

create function public.create_ratings_for_new_category()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.ratings (user_id, category)
  select id, new.slug from public.profiles
  on conflict (user_id, category) do nothing;
  return new;
end;
$$;

create trigger on_category_created
  after insert on public.categories
  for each row execute function public.create_ratings_for_new_category();

create function public.apply_game_result(p_game_id uuid, p_payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_game public.games%rowtype;
  current_rating public.ratings%rowtype;
  player_a_payload jsonb;
  player_b_payload jsonb;
  next_winner text;
  next_score_a integer;
  next_score_b integer;
  expected_before double precision;
begin
  select * into target_game
  from public.games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;

  if target_game.status <> 'active' then
    return false;
  end if;

  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_game_result_payload' using errcode = '22023';
  end if;

  next_winner := p_payload ->> 'winner';
  next_score_a := (p_payload ->> 'score_a')::integer;
  next_score_b := (p_payload ->> 'score_b')::integer;
  player_a_payload := p_payload -> 'player_a';
  player_b_payload := p_payload -> 'player_b';

  if next_winner is null or next_winner not in ('a', 'b', 'draw')
    or next_score_a is null or next_score_a < 0
    or next_score_b is null or next_score_b < 0 then
    raise exception 'invalid_game_result_payload' using errcode = '22023';
  end if;

  if jsonb_typeof(player_a_payload) <> 'object'
    or (target_game.player_b is not null and jsonb_typeof(player_b_payload) <> 'object') then
    raise exception 'invalid_rating_payload' using errcode = '22023';
  end if;

  perform 1
  from public.ratings
  where category = target_game.category
    and user_id in (target_game.player_a, target_game.player_b)
  order by user_id
  for update;

  select * into current_rating
  from public.ratings
  where user_id = target_game.player_a and category = target_game.category;
  if not found then
    raise exception 'player_a_rating_not_found' using errcode = 'P0002';
  end if;
  expected_before := (player_a_payload ->> 'rating_before')::double precision;
  if expected_before is null or abs(current_rating.rating - expected_before) > 0.000001 then
    raise exception 'rating_state_changed' using errcode = '40001';
  end if;

  update public.ratings
  set rating = (player_a_payload ->> 'rating_after')::double precision,
      rd = (player_a_payload ->> 'rd_after')::double precision,
      vol = (player_a_payload ->> 'vol_after')::double precision,
      games_played = games_played + 1,
      updated_at = now()
  where user_id = target_game.player_a and category = target_game.category;

  insert into public.rating_history (user_id, category, game_id, rating_before, rating_after, rd_after)
  values (
    target_game.player_a,
    target_game.category,
    target_game.id,
    expected_before,
    (player_a_payload ->> 'rating_after')::double precision,
    (player_a_payload ->> 'rd_after')::double precision
  );

  if target_game.player_b is not null then
    select * into current_rating
    from public.ratings
    where user_id = target_game.player_b and category = target_game.category;
    if not found then
      raise exception 'player_b_rating_not_found' using errcode = 'P0002';
    end if;
    expected_before := (player_b_payload ->> 'rating_before')::double precision;
    if expected_before is null or abs(current_rating.rating - expected_before) > 0.000001 then
      raise exception 'rating_state_changed' using errcode = '40001';
    end if;

    update public.ratings
    set rating = (player_b_payload ->> 'rating_after')::double precision,
        rd = (player_b_payload ->> 'rd_after')::double precision,
        vol = (player_b_payload ->> 'vol_after')::double precision,
        games_played = games_played + 1,
        updated_at = now()
    where user_id = target_game.player_b and category = target_game.category;

    insert into public.rating_history (user_id, category, game_id, rating_before, rating_after, rd_after)
    values (
      target_game.player_b,
      target_game.category,
      target_game.id,
      expected_before,
      (player_b_payload ->> 'rating_after')::double precision,
      (player_b_payload ->> 'rd_after')::double precision
    );
  end if;

  update public.games
  set status = 'finished',
      winner = next_winner,
      score_a = next_score_a,
      score_b = next_score_b,
      rating_a_before = (player_a_payload ->> 'rating_before')::double precision,
      rating_a_after = (player_a_payload ->> 'rating_after')::double precision,
      rating_b_before = case when target_game.player_b is null then null else (player_b_payload ->> 'rating_before')::double precision end,
      rating_b_after = case when target_game.player_b is null then null else (player_b_payload ->> 'rating_after')::double precision end,
      finished_at = now()
  where id = target_game.id and status = 'active';

  return true;
end;
$$;

alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.ratings enable row level security;
alter table public.rating_history enable row level security;
alter table public.questions enable row level security;
alter table public.games enable row level security;
alter table public.game_questions enable row level security;
alter table public.game_moves enable row level security;
alter table public.game_bot_plans enable row level security;
alter table public.matchmaking_queue enable row level security;

create policy categories_authenticated_read on public.categories
  for select to authenticated using (true);
create policy profiles_authenticated_read on public.profiles
  for select to authenticated using (true);
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create policy ratings_authenticated_read on public.ratings
  for select to authenticated using (true);
create policy rating_history_authenticated_read on public.rating_history
  for select to authenticated using (true);
create policy matchmaking_queue_read_self on public.matchmaking_queue
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.categories, public.profiles, public.ratings, public.rating_history,
  public.questions, public.games, public.game_questions, public.game_moves,
  public.game_bot_plans, public.matchmaking_queue
from anon, authenticated;

grant usage on schema public to authenticated, service_role;
grant select on public.categories, public.ratings, public.rating_history to authenticated;
grant select (id, username, avatar_url, role, created_at) on public.profiles to authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;
grant select (user_id, category, rating, rd, vol, games_played, updated_at)
  on public.ratings to authenticated;
grant select on public.matchmaking_queue to authenticated;
grant all on public.categories, public.profiles, public.ratings, public.rating_history,
  public.questions, public.games, public.game_questions, public.game_moves,
  public.game_bot_plans, public.matchmaking_queue to service_role;

grant execute on function public.apply_game_result(uuid, jsonb) to service_role;
revoke execute on function public.apply_game_result(uuid, jsonb) from public, anon, authenticated;

commit;
