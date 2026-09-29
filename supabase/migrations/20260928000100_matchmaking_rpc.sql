begin;

alter table public.matchmaking_queue
  add column preset text not null default 'standard'
    check (preset in ('blitz', 'standard'));

create function public.join_matchmaking_queue(
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
  if p_preset not in ('blitz', 'standard') or p_rating is null or p_rating < 0 then
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
  else
    configured_question_count := 10;
    configured_seconds_per_question := 20;
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

  if existing_queue_found
    and existing_game_id is null
    and existing_category = p_category
    and existing_preset = p_preset then
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
    category,
    preset,
    question_count,
    seconds_per_question,
    player_a,
    player_b,
    question_started_at
  )
  values (
    p_category,
    p_preset,
    configured_question_count,
    configured_seconds_per_question,
    candidate_user_id,
    p_user_id,
    now()
  )
  returning id into new_game_id;

  insert into public.game_questions (game_id, position, question_id)
  select new_game_id, row_number() over () - 1, selected.id
  from (
    select q.id
    from public.questions q
    where q.status = 'active'
      and (p_category = 'mixed' or q.category = p_category)
    order by random()
    limit configured_question_count
  ) as selected;

  update public.matchmaking_queue
  set matched_game_id = new_game_id
  where user_id = candidate_user_id;

  insert into public.matchmaking_queue (user_id, category, preset, rating, matched_game_id, bot_after_ms)
  values (p_user_id, p_category, p_preset, p_rating, new_game_id, 30000);

  return new_game_id;
end;
$$;

revoke execute on function public.join_matchmaking_queue(uuid, text, text, double precision)
  from public, anon, authenticated;
grant execute on function public.join_matchmaking_queue(uuid, text, text, double precision)
  to service_role;

commit;