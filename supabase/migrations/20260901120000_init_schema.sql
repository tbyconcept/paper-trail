-- Paper Trail core schema (build step 2).
--
-- Auth is phone OTP via Supabase Auth (auth.users), which this migration
-- does not touch directly. public.users mirrors auth.users 1:1 and is
-- populated by the on_auth_user_created trigger below.
--
-- RLS policy shape follows the brief's "server is the timing authority"
-- rule (section 1): messages/flight_events/send_limits/purchases have no
-- INSERT/UPDATE policy for the `authenticated` role at all. Those rows
-- are written by a SECURITY DEFINER function or Edge Function running as
-- `service_role` (which bypasses RLS), added in later build steps (3, 6,
-- 7, 8) -- a client can request a send, but cannot itself choose
-- departed_at/duration_ms or fabricate a landing.

create extension if not exists "pgcrypto";

-- USERS -----------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique,
  display_name text,
  phone_hash text,
  push_token text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users can view own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "users can update own profile"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No INSERT policy: rows are created only by the trigger below.

-- Public lookup of non-sensitive profile fields (contact search, showing
-- a sender/recipient's name before they're in your contacts). Owned by
-- the migration role, so it runs against public.users without being
-- subject to the owner-only policies above, and only ever exposes the
-- three columns selected here -- phone_hash and push_token are never
-- reachable through it.
create view public.profiles as
  select id, handle, display_name from public.users;

grant select on public.profiles to authenticated;

-- phone_hash is sha256(E.164 phone number), hex-encoded, kept in sync by
-- these two triggers. Step 9's device-contact matching hashes local
-- numbers the same way and compares.
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, phone_hash)
  values (
    new.id,
    case when new.phone is not null and new.phone <> ''
      then encode(digest(new.phone, 'sha256'), 'hex')
      else null
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create function public.handle_auth_user_phone_updated()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.phone is distinct from old.phone then
    update public.users
      set phone_hash = case when new.phone is not null and new.phone <> ''
        then encode(digest(new.phone, 'sha256'), 'hex')
        else null
      end
      where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_phone_updated
  after update of phone on auth.users
  for each row execute function public.handle_auth_user_phone_updated();

-- CONTACTS ----------------------------------------------------------------

create table public.contacts (
  user_id uuid not null references public.users (id) on delete cascade,
  contact_user_id uuid not null references public.users (id) on delete cascade,
  source text not null check (source in ('device', 'manual')),
  created_at timestamptz not null default now(),
  primary key (user_id, contact_user_id),
  check (user_id <> contact_user_id)
);

alter table public.contacts enable row level security;

create policy "users manage their own contact list"
  on public.contacts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- MESSAGES ------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users (id) on delete cascade,
  recipient_id uuid not null references public.users (id) on delete cascade,
  content_type text not null check (content_type in ('typed', 'handwritten')),
  content_text text,
  content_strokes jsonb,
  pen_color text,
  paper_style text,
  departed_at timestamptz not null default now(),
  duration_ms integer not null,
  landed_at timestamptz,
  distance_miles double precision,
  status text not null default 'in_flight' check (status in ('in_flight', 'landed')),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index messages_sender_idx on public.messages (sender_id);
create index messages_recipient_idx on public.messages (recipient_id);

alter table public.messages enable row level security;

create policy "participants can view their messages"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- No INSERT/UPDATE policy for `authenticated` -- see the file header note.

-- FLIGHT_EVENTS -------------------------------------------------------------

create table public.flight_events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  event_type text not null check (
    event_type in ('wind', 'rain', 'thermal', 'bird', 'tree', 'departed', 'landed')
  ),
  progress_at_trigger real check (progress_at_trigger between 0 and 1),
  occurred_at timestamptz not null default now(),
  detail jsonb
);

create index flight_events_message_idx on public.flight_events (message_id);

alter table public.flight_events enable row level security;

create policy "participants can view flight events for their messages"
  on public.flight_events for select
  using (
    exists (
      select 1 from public.messages m
      where m.id = flight_events.message_id
        and (auth.uid() = m.sender_id or auth.uid() = m.recipient_id)
    )
  );

-- No INSERT policy -- see the file header note.

-- SEND_LIMITS -----------------------------------------------------------

create table public.send_limits (
  user_id uuid not null references public.users (id) on delete cascade,
  date date not null,
  free_sends_used integer not null default 0,
  free_sends_cap integer not null default 3,
  primary key (user_id, date)
);

alter table public.send_limits enable row level security;

create policy "users can view their own send limits"
  on public.send_limits for select
  using (auth.uid() = user_id);

-- No INSERT/UPDATE policy -- see the file header note.

-- PURCHASES -----------------------------------------------------------------

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  product_id text not null,
  type text not null check (type in ('extra_sends', 'cosmetic')),
  purchased_at timestamptz not null default now()
);

alter table public.purchases enable row level security;

create policy "users can view their own purchases"
  on public.purchases for select
  using (auth.uid() = user_id);

-- No INSERT policy -- see the file header note.
