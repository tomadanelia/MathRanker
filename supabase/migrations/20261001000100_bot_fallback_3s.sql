begin;

create function public.enforce_matchmaking_bot_delay()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.bot_after_ms := 3000;
  return new;
end;
$$;

create trigger matchmaking_queue_bot_delay
before insert or update of bot_after_ms on public.matchmaking_queue
for each row execute function public.enforce_matchmaking_bot_delay();

update public.matchmaking_queue
set bot_after_ms = 3000
where matched_game_id is null;

commit;
