-- Server-side landing sweep, pulled forward ahead of step 6.
--
-- Until now, a message only transitioned to 'landed' when the sender's or
-- recipient's Tracking screen happened to be open past the flight duration
-- and called land_message itself (client-triggered, see send_flow.sql).
-- That's fine as an instant-feedback path when someone is actually
-- watching, but Standard mode's flights run real hours/days, so "nobody
-- has Tracking open at the exact landing moment" is the common case, not
-- an edge case -- without this sweep, a message can sit at 'in_flight'
-- indefinitely after it should have landed, and step 6's landing push
-- notification would have nothing reliable to trigger off of.
--
-- sweep_landed_messages() is the correctness backstop: a SECURITY DEFINER
-- function invoked on a schedule (pg_cron below), independent of any
-- client or session. land_message stays exactly as it was for the
-- immediate-feedback path.

-- Powers the sweep's WHERE clause: narrows the scan to the (typically
-- small) set of still-in-flight messages regardless of total message
-- volume, since landed messages drop out of the partial index.
create index messages_in_flight_departed_idx on public.messages (departed_at)
  where status = 'in_flight';

-- land_message hardening -------------------------------------------------
--
-- Introducing a second writer (the sweep) that can land a message means
-- land_message's own read-then-write is now racier than before: it SELECTs
-- the row, checks status/timing, then UPDATEs by id alone. If the sweep
-- lands the same row in between, the old UPDATE would still succeed
-- (no WHERE on status), silently overwriting landed_at and inserting a
-- second 'landed' flight_events row for the same message. Made the UPDATE
-- conditional on status still being 'in_flight' -- same atomic
-- update-or-skip shape send_message already uses for the free-send cap --
-- and fall back to returning the authoritative row when it's lost the race.
create or replace function public.land_message(p_message_id uuid)
returns public.messages
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_message public.messages;
begin
  select * into v_message from public.messages where id = p_message_id;

  if v_message is null then
    raise exception 'message not found';
  end if;
  if v_uid is null or (v_uid <> v_message.sender_id and v_uid <> v_message.recipient_id) then
    raise exception 'not authorized';
  end if;
  if v_message.status = 'landed' then
    return v_message;
  end if;
  if now() < v_message.departed_at + make_interval(secs => v_message.duration_ms / 1000.0) then
    raise exception 'NOT_YET_LANDED';
  end if;

  update public.messages
    set status = 'landed', landed_at = now()
    where id = p_message_id and status = 'in_flight'
    returning * into v_message;

  if not found then
    -- Lost the race (the sweep, or the other party's own Tracking screen,
    -- landed it first between our SELECT and this UPDATE) -- return the
    -- current row instead of double-writing.
    select * into v_message from public.messages where id = p_message_id;
    return v_message;
  end if;

  insert into public.flight_events (message_id, event_type, progress_at_trigger)
  values (p_message_id, 'landed', 1);

  return v_message;
end;
$$;

-- The sweep itself ---------------------------------------------------------
--
-- SECURITY DEFINER but deliberately NOT granted to anon/authenticated --
-- unlike send_message/land_message this is not meant to be a client-
-- callable RPC. It bypasses PostgREST/RLS entirely and only runs via the
-- trusted pg_cron schedule below (or manual invocation as postgres).
create function public.sweep_landed_messages()
returns setof public.messages
language plpgsql
security definer set search_path = public
as $$
begin
  return query
  with due as (
    select id
    from public.messages
    where status = 'in_flight'
      and now() >= departed_at + make_interval(secs => duration_ms / 1000.0)
    -- SKIP LOCKED so an overlapping run (a slow sweep still finishing when
    -- the next cron tick fires) can't double-process the same rows.
    for update skip locked
  ),
  landed as (
    update public.messages m
      set status = 'landed', landed_at = now()
      from due
      where m.id = due.id
      returning m.*
  ),
  -- Same trigger point land_message already uses for a landing: a
  -- flight_events row. This is the natural hook for step 6's landing
  -- notification to attach to later (e.g. a trigger on this insert, or a
  -- follow-up poll of flight_events) -- actual push delivery (device
  -- tokens, the Expo push API call) isn't built yet and is intentionally
  -- not fabricated here.
  logged as (
    insert into public.flight_events (message_id, event_type, progress_at_trigger)
    select id, 'landed', 1 from landed
    returning message_id
  )
  select landed.*
  from landed
  -- Joined (rather than left as an unreferenced CTE) so the insert above
  -- is guaranteed to execute -- Postgres only guarantees a data-modifying
  -- CTE runs when something downstream actually references it.
  join logged on logged.message_id = landed.id;
end;
$$;

revoke all on function public.sweep_landed_messages() from public, anon, authenticated;

-- Scheduling -----------------------------------------------------------
--
-- Requires pg_cron (bundled with Supabase; enable via Database ->
-- Extensions in the dashboard first if this errors on a plan where it
-- isn't already on).
create extension if not exists pg_cron with schema extensions;

-- Every minute is cheap -- the partial index above keeps the scan bounded
-- to in-flight rows only -- and bounds "how late can a landing be detected
-- with nobody watching" to ~1 minute worst case, which is plenty against
-- multi-hour/day flights.
select cron.schedule(
  'sweep-landed-messages',
  '* * * * *',
  $$select public.sweep_landed_messages();$$
)
where not exists (
  select 1 from cron.job where jobname = 'sweep-landed-messages'
);
