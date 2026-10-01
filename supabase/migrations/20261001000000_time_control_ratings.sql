begin;

alter table public.ratings
  add column preset text not null default 'standard';

alter table public.ratings
  drop constraint ratings_pkey,
  add constraint ratings_pkey primary key (user_id, category, preset),
  add constraint ratings_preset_check check (preset in ('blitz', 'standard', 'rapid'));

insert into public.ratings (user_id, category, preset)
select profiles.id, categories.slug, time_controls.preset
from public.profiles
cross join public.categories
cross join (values ('blitz'), ('rapid')) as time_controls(preset)
on conflict (user_id, category, preset) do nothing;

alter table public.rating_history
  add column preset text not null default 'standard',
  add constraint rating_history_preset_check check (preset in ('blitz', 'standard', 'rapid'));

 drop index public.rating_history_user_category_created_idx;
create index rating_history_user_category_preset_created_idx
  on public.rating_history (user_id, category, preset, created_at);

alter table public.matchmaking_queue
  drop constraint matchmaking_queue_preset_check,
  add constraint matchmaking_queue_preset_check check (preset in ('blitz', 'standard', 'rapid'));

create or replace function public.create_profile_for_auth_user()
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
      exit when not exists (select 1 from public.profiles where username = candidate_username);
    end loop;
    requested_username := candidate_username;
  end if;

  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    requested_username,
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  );

  insert into public.ratings (user_id, category, preset)
  select new.id, categories.slug, time_controls.preset
  from public.categories
  cross join (values ('blitz'), ('standard'), ('rapid')) as time_controls(preset);

  return new;
end;
$$;

create or replace function public.create_ratings_for_new_category()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.ratings (user_id, category, preset)
  select profiles.id, new.slug, time_controls.preset
  from public.profiles
  cross join (values ('blitz'), ('standard'), ('rapid')) as time_controls(preset)
  on conflict (user_id, category, preset) do nothing;
  return new;
end;
$$;

create or replace function public.apply_game_result(p_game_id uuid, p_payload jsonb)
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
    and preset = target_game.preset
    and user_id in (target_game.player_a, target_game.player_b)
  order by user_id
  for update;

  select * into current_rating
  from public.ratings
  where user_id = target_game.player_a
    and category = target_game.category
    and preset = target_game.preset;
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
  where user_id = target_game.player_a
    and category = target_game.category
    and preset = target_game.preset;

  insert into public.rating_history (user_id, category, preset, game_id, rating_before, rating_after, rd_after)
  values (
    target_game.player_a,
    target_game.category,
    target_game.preset,
    target_game.id,
    expected_before,
    (player_a_payload ->> 'rating_after')::double precision,
    (player_a_payload ->> 'rd_after')::double precision
  );

  if target_game.player_b is not null then
    select * into current_rating
    from public.ratings
    where user_id = target_game.player_b
      and category = target_game.category
      and preset = target_game.preset;
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
    where user_id = target_game.player_b
      and category = target_game.category
      and preset = target_game.preset;

    insert into public.rating_history (user_id, category, preset, game_id, rating_before, rating_after, rd_after)
    values (
      target_game.player_b,
      target_game.category,
      target_game.preset,
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

create or replace function public.join_matchmaking_queue(
  p_user_id uuid,
  p_category text,
  p_preset text,
  p_rating double precision
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  candidate_user_id uuid;
  existing_game_id uuid;
  new_game_id uuid;
  configured_question_count integer;
  configured_seconds_per_question integer;
  available_question_count integer;
  selected_category_is_virtual boolean;
  existing_category text;
  existing_preset text;
  existing_queue_found boolean;
begin
  if p_preset not in ('blitz', 'standard', 'rapid') or p_rating is null or p_rating < 0 then
    raise exception 'invalid_matchmaking_request' using errcode = '22023';
  end if;

  select is_virtual into selected_category_is_virtual
  from public.categories
  where slug = p_category;
  if not found then
    raise exception 'category_not_found' using errcode = 'P0002';
  end if;
  if selected_category_is_virtual and p_category <> 'mixed' then
    raise exception 'category_not_found' using errcode = 'P0002';
  end if;

  if p_preset = 'blitz' then
    configured_question_count := 5;
    configured_seconds_per_question := 10;
  elsif p_preset = 'standard' then
    configured_question_count := 10;
    configured_seconds_per_question := 20;
  else
    configured_question_count := 10;
    configured_seconds_per_question := 45;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_category, 0));

  select matched_game_id, category, preset
  into existing_game_id, existing_category, existing_preset
  from public.matchmaking_queue
  where user_id = p_user_id
  for update;
  existing_queue_found := found;

  if existing_game_id is not null and exists (
    select 1 from public.games where id = existing_game_id and status = 'active'
  ) then
    return existing_game_id;
  end if;
  if existing_queue_found and existing_game_id is null
    and existing_category = p_category and existing_preset = p_preset then
    return null;
  end if;

  delete from public.matchmaking_queue where user_id = p_user_id;

  select user_id into candidate_user_id
  from public.matchmaking_queue
  where category = p_category
    and preset = p_preset
    and user_id <> p_user_id
    and matched_game_id is null
  order by joined_at
  limit 1
  for update skip locked;

  if candidate_user_id is null then
    insert into public.matchmaking_queue (user_id, category, preset, rating, bot_after_ms)
    values (p_user_id, p_category, p_preset, p_rating, 30000);
    return null;
  end if;

  select count(*) into available_question_count
  from public.questions q
  where q.status = 'active'
    and (p_category = 'mixed' or q.category = p_category);
  if available_question_count < configured_question_count then
    raise exception 'insufficient_active_questions' using errcode = 'P0001';
  end if;

  insert into public.games (
    category, preset, question_count, seconds_per_question,
    player_a, player_b, question_started_at
  ) values (
    p_category, p_preset, configured_question_count, configured_seconds_per_question,
    candidate_user_id, p_user_id, now()
  ) returning id into new_game_id;

  insert into public.game_questions (game_id, position, question_id)
  select new_game_id, row_number() over () - 1, selected.id
  from (
    select q.id from public.questions q
    where q.status = 'active'
      and (p_category = 'mixed' or q.category = p_category)
    order by random()
    limit configured_question_count
  ) as selected;

  update public.matchmaking_queue set matched_game_id = new_game_id
  where user_id = candidate_user_id;
  insert into public.matchmaking_queue (user_id, category, preset, rating, matched_game_id, bot_after_ms)
  values (p_user_id, p_category, p_preset, p_rating, new_game_id, 30000);

  return new_game_id;
end;
$$;

create or replace function public.create_bot_game_for_waiting_player(
  p_user_id uuid,
  p_bot_display_name text,
  p_bot_rating integer,
  p_plan jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  queue_category text;
  queue_entry public.matchmaking_queue%rowtype;
  bot_question_count integer;
  bot_seconds_per_question integer;
  available_question_count integer;
  new_game_id uuid;
begin
  select category into queue_category
  from public.matchmaking_queue where user_id = p_user_id;
  if not found then return null; end if;

  perform pg_advisory_xact_lock(hashtextextended(queue_category, 0));

  select * into queue_entry
  from public.matchmaking_queue
  where user_id = p_user_id
  for update;
  if not found then return null; end if;
  if queue_entry.matched_game_id is not null then return queue_entry.matched_game_id; end if;
  if clock_timestamp() < queue_entry.joined_at + make_interval(secs => queue_entry.bot_after_ms / 1000.0) then
    return null;
  end if;

  if queue_entry.preset = 'blitz' then
    bot_question_count := 5;
    bot_seconds_per_question := 10;
  elsif queue_entry.preset = 'standard' then
    bot_question_count := 10;
    bot_seconds_per_question := 20;
  elsif queue_entry.preset = 'rapid' then
    bot_question_count := 10;
    bot_seconds_per_question := 45;
  else
    raise exception 'unsupported_match_preset' using errcode = '22023';
  end if;

  if p_bot_display_name is null or length(p_bot_display_name) > 40
    or p_bot_rating is null or p_bot_rating < 0
    or jsonb_typeof(p_plan) <> 'array'
    or jsonb_array_length(p_plan) <> bot_question_count then
    raise exception 'invalid_bot_plan' using errcode = '22023';
  end if;

  select count(*) into available_question_count
  from public.questions q
  where q.status = 'active'
    and (queue_entry.category = 'mixed' or q.category = queue_entry.category);
  if available_question_count < bot_question_count then
    raise exception 'insufficient_active_questions' using errcode = 'P0001';
  end if;

  insert into public.games (
    category, preset, question_count, seconds_per_question,
    player_a, player_b, is_bot, bot_display_name, bot_display_rating, question_started_at
  ) values (
    queue_entry.category, queue_entry.preset, bot_question_count, bot_seconds_per_question,
    p_user_id, null, true, p_bot_display_name, p_bot_rating, clock_timestamp()
  ) returning id into new_game_id;

  insert into public.game_questions (game_id, position, question_id)
  select new_game_id, row_number() over () - 1, selected.id
  from (
    select q.id from public.questions q
    where q.status = 'active'
      and (queue_entry.category = 'mixed' or q.category = queue_entry.category)
    order by random()
    limit bot_question_count
  ) as selected;

  insert into public.game_bot_plans (game_id, plan, bot_rating_used)
  values (new_game_id, p_plan, p_bot_rating);
  update public.matchmaking_queue
  set matched_game_id = new_game_id
  where user_id = p_user_id and matched_game_id is null;

  return new_game_id;
end;
$$;

revoke execute on function public.apply_game_result(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.join_matchmaking_queue(uuid, text, text, double precision) from public, anon, authenticated;
revoke execute on function public.create_bot_game_for_waiting_player(uuid, text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.apply_game_result(uuid, jsonb) to service_role;
grant execute on function public.join_matchmaking_queue(uuid, text, text, double precision) to service_role;
grant execute on function public.create_bot_game_for_waiting_player(uuid, text, integer, jsonb) to service_role;
grant select (user_id, category, preset, rating, rd, vol, games_played, updated_at) on public.ratings to authenticated;

commit;
