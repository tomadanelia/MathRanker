begin;

create function public.advance_game_after_move(p_game_id uuid, p_position integer, p_transition_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_game public.games%rowtype;
  current_score_a integer;
  current_score_b integer;
  current_time_a bigint;
  current_time_b bigint;
  next_winner text;
  move_count integer;
begin
  select * into target_game
  from public.games
  where id = p_game_id
  for update;

  if not found or target_game.status <> 'active' or target_game.current_position <> p_position then
    return jsonb_build_object('gameFinished', false, 'currentPosition', p_position);
  end if;

  select count(*) into move_count
  from public.game_moves
  where game_id = p_game_id and position = p_position;

  if move_count < 2 then
    return jsonb_build_object(
      'gameFinished', false,
      'currentPosition', target_game.current_position,
      'scoreA', coalesce(target_game.score_a, 0),
      'scoreB', coalesce(target_game.score_b, 0)
    );
  end if;

  select
    coalesce(target_game.score_a, 0) + count(*) filter (where side = 'a' and is_correct),
    coalesce(target_game.score_b, 0) + count(*) filter (where side = 'b' and is_correct)
  into current_score_a, current_score_b
  from public.game_moves
  where game_id = p_game_id and position = p_position;

  if p_position + 1 < target_game.question_count then
    update public.games
    set current_position = p_position + 1,
        question_started_at = p_transition_at,
        score_a = current_score_a,
        score_b = current_score_b
    where id = p_game_id;

    return jsonb_build_object(
      'gameFinished', false,
      'currentPosition', p_position + 1,
      'scoreA', current_score_a,
      'scoreB', current_score_b
    );
  end if;

  select
    coalesce(sum(time_taken_ms) filter (where side = 'a' and is_correct), 0),
    coalesce(sum(time_taken_ms) filter (where side = 'b' and is_correct), 0)
  into current_time_a, current_time_b
  from public.game_moves
  where game_id = p_game_id;

  if current_score_a > current_score_b then
    next_winner := 'a';
  elsif current_score_b > current_score_a then
    next_winner := 'b';
  elsif current_time_a < current_time_b then
    next_winner := 'a';
  elsif current_time_b < current_time_a then
    next_winner := 'b';
  else
    next_winner := 'draw';
  end if;

  update public.games
  set winner = next_winner,
      score_a = current_score_a,
      score_b = current_score_b,
      current_position = target_game.question_count,
      question_started_at = null
  where id = p_game_id;

  return jsonb_build_object(
    'gameFinished', true,
    'currentPosition', target_game.question_count,
    'scoreA', current_score_a,
    'scoreB', current_score_b,
    'winner', next_winner
  );
end;
$$;

create function public.create_bot_game_for_waiting_player(
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
  queue_preset text;
  queue_entry public.matchmaking_queue%rowtype;
  bot_question_count integer;
  bot_seconds_per_question integer;
  available_question_count integer;
  new_game_id uuid;
begin
  select category into queue_category
  from public.matchmaking_queue
  where user_id = p_user_id;

  if not found then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(queue_category, 0));

  select * into queue_entry
  from public.matchmaking_queue
  where user_id = p_user_id
  for update;

  if not found then
    return null;
  end if;

  if queue_entry.matched_game_id is not null then
    return queue_entry.matched_game_id;
  end if;

  if clock_timestamp() < queue_entry.joined_at + make_interval(secs => queue_entry.bot_after_ms / 1000.0) then
    return null;
  end if;

  if queue_entry.preset = 'blitz' then
    bot_question_count := 5;
    bot_seconds_per_question := 10;
  elsif queue_entry.preset = 'standard' then
    bot_question_count := 10;
    bot_seconds_per_question := 20;
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
    category,
    preset,
    question_count,
    seconds_per_question,
    player_a,
    player_b,
    is_bot,
    bot_display_name,
    bot_display_rating,
    question_started_at
  )
  values (
    queue_entry.category,
    queue_entry.preset,
    bot_question_count,
    bot_seconds_per_question,
    p_user_id,
    null,
    true,
    p_bot_display_name,
    p_bot_rating,
    clock_timestamp()
  )
  returning id into new_game_id;

  insert into public.game_questions (game_id, position, question_id)
  select new_game_id, row_number() over () - 1, selected.id
  from (
    select q.id
    from public.questions q
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

create function public.process_game_bot_turn(p_game_id uuid, p_position integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_game public.games%rowtype;
  plan_entry jsonb;
  response_delay_ms integer;
  response_at timestamptz;
  transition_result jsonb;
begin
  select * into target_game
  from public.games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;

  if not target_game.is_bot or target_game.status <> 'active'
    or target_game.current_position <> p_position then
    return jsonb_build_object('botAnswered', false, 'gameFinished', target_game.status = 'finished');
  end if;

  select plan -> p_position into plan_entry
  from public.game_bot_plans
  where game_id = p_game_id;

  if plan_entry is null then
    raise exception 'bot_plan_not_found' using errcode = 'P0002';
  end if;

  response_delay_ms := greatest(
    0,
    least(
      target_game.seconds_per_question * 1000,
      coalesce((plan_entry ->> 'respondAfterMs')::integer, target_game.seconds_per_question * 1000)
    )
  );
  response_at := target_game.question_started_at + make_interval(secs => response_delay_ms / 1000.0);

  if clock_timestamp() < response_at then
    return jsonb_build_object(
      'botAnswered', false,
      'gameFinished', false,
      'currentPosition', target_game.current_position
    );
  end if;

  insert into public.game_moves (
    game_id,
    position,
    side,
    answer_given,
    is_correct,
    time_taken_ms,
    answered_at
  )
  values (
    p_game_id,
    p_position,
    'b',
    coalesce(plan_entry ->> 'answer', ''),
    coalesce((plan_entry ->> 'willBeCorrect')::boolean, false),
    response_delay_ms,
    response_at
  )
  on conflict (game_id, position, side) do nothing;

  transition_result := public.advance_game_after_move(p_game_id, p_position, clock_timestamp());
  return transition_result || jsonb_build_object('botAnswered', true);
end;
$$;

create or replace function public.submit_game_answer(
  p_game_id uuid,
  p_user_id uuid,
  p_position integer,
  p_question_id uuid,
  p_answer text,
  p_is_correct boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_game public.games%rowtype;
  player_side text;
  deadline timestamptz;
  submitted_at timestamptz;
  answer_is_late boolean;
  transition_result jsonb;
begin
  select * into target_game
  from public.games
  where id = p_game_id
  for update;

  submitted_at := clock_timestamp();

  if not found then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;

  if target_game.player_a = p_user_id then
    player_side := 'a';
  elsif target_game.player_b = p_user_id then
    player_side := 'b';
  else
    raise exception 'not_a_game_player' using errcode = '42501';
  end if;

  if target_game.status <> 'active' then
    raise exception 'game_not_active' using errcode = 'P0001';
  end if;

  if p_position <> target_game.current_position then
    raise exception 'stale_game_position' using errcode = 'P0001';
  end if;

  if target_game.question_started_at is null then
    raise exception 'question_not_started' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.game_questions
    where game_id = p_game_id and position = p_position and question_id = p_question_id
  ) then
    raise exception 'question_assignment_mismatch' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.game_moves
    where game_id = p_game_id and position = p_position and side = player_side
  ) then
    return jsonb_build_object('accepted', false, 'reason', 'already_answered', 'gameFinished', false);
  end if;

  deadline := target_game.question_started_at
    + make_interval(secs => target_game.seconds_per_question);
  answer_is_late := submitted_at > deadline;

  insert into public.game_moves (
    game_id,
    position,
    side,
    answer_given,
    is_correct,
    time_taken_ms,
    answered_at
  )
  values (
    p_game_id,
    p_position,
    player_side,
    case when answer_is_late then null else p_answer end,
    coalesce(p_is_correct, false) and not answer_is_late,
    case
      when answer_is_late then target_game.seconds_per_question * 1000
      else greatest(
        0,
        least(
          target_game.seconds_per_question * 1000,
          ceil(extract(epoch from (submitted_at - target_game.question_started_at)) * 1000)::integer
        )
      )
    end,
    submitted_at
  );

  if target_game.is_bot then
    transition_result := public.process_game_bot_turn(p_game_id, p_position);
  else
    transition_result := public.advance_game_after_move(p_game_id, p_position, submitted_at);
  end if;

  return transition_result || jsonb_build_object(
    'accepted', true,
    'timeExpired', answer_is_late
  );
end;
$$;

revoke execute on function public.advance_game_after_move(uuid, integer, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.create_bot_game_for_waiting_player(uuid, text, integer, jsonb)
  from public, anon, authenticated;
revoke execute on function public.process_game_bot_turn(uuid, integer)
  from public, anon, authenticated;
revoke execute on function public.submit_game_answer(uuid, uuid, integer, uuid, text, boolean)
  from public, anon, authenticated;

grant execute on function public.create_bot_game_for_waiting_player(uuid, text, integer, jsonb)
  to service_role;
grant execute on function public.process_game_bot_turn(uuid, integer)
  to service_role;
grant execute on function public.submit_game_answer(uuid, uuid, integer, uuid, text, boolean)
  to service_role;

commit;
