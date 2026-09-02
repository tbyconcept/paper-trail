-- Build step 3: compose send -> tracking flow.
--
-- Clients have no INSERT/UPDATE policy on messages/flight_events/send_limits
-- (see 20260901120000_init_schema.sql's header note) -- these two
-- SECURITY DEFINER functions are the only way in. send_message is the
-- timing authority (it alone picks departed_at/duration_ms) and the daily
-- free-send gate; land_message re-checks elapsed flight time itself before
-- writing landed_at, so a client calling it early just gets rejected rather
-- than being able to fabricate an early landing.

create function public.send_message(
  p_recipient_id uuid,
  p_content_type text,
  p_content_text text default null,
  p_content_strokes jsonb default null,
  p_pen_color text default null,
  p_paper_style text default null
)
returns public.messages
language plpgsql
security definer set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_duration_ms integer;
  v_used integer;
  v_message public.messages;
begin
  if v_sender_id is null then
    raise exception 'not authenticated';
  end if;

  -- Daily free-send cap (purchased extra sends land in build step 8).
  -- The WHERE on the update branch makes this atomic: if the existing
  -- row is already at cap, the conflict is skipped, RETURNING yields no
  -- row, and v_used stays null.
  insert into public.send_limits (user_id, date, free_sends_used)
  values (v_sender_id, current_date, 1)
  on conflict (user_id, date) do update
    set free_sends_used = send_limits.free_sends_used + 1
    where send_limits.free_sends_used < send_limits.free_sends_cap
  returning free_sends_used into v_used;

  if v_used is null then
    raise exception 'SEND_LIMIT_EXCEEDED';
  end if;

  -- Stand-in flight duration until distance/weather shape it (step 6): a
  -- flat 20-60s random flight.
  v_duration_ms := 20000 + floor(random() * 40000)::int;

  insert into public.messages (
    sender_id, recipient_id, content_type, content_text, content_strokes,
    pen_color, paper_style, departed_at, duration_ms, status
  ) values (
    v_sender_id, p_recipient_id, p_content_type, p_content_text, p_content_strokes,
    p_pen_color, p_paper_style, now(), v_duration_ms, 'in_flight'
  )
  returning * into v_message;

  insert into public.flight_events (message_id, event_type, progress_at_trigger)
  values (v_message.id, 'departed', 0);

  return v_message;
end;
$$;

revoke all on function public.send_message(uuid, text, text, jsonb, text, text) from public;
grant execute on function public.send_message(uuid, text, text, jsonb, text, text) to authenticated;

create function public.land_message(p_message_id uuid)
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
    where id = p_message_id
    returning * into v_message;

  insert into public.flight_events (message_id, event_type, progress_at_trigger)
  values (p_message_id, 'landed', 1);

  return v_message;
end;
$$;

revoke all on function public.land_message(uuid) from public;
grant execute on function public.land_message(uuid) to authenticated;
