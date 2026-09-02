-- Fixes a bug in the previous migration: pgcrypto installs into Supabase's
-- `extensions` schema, not `public`, so the trigger functions' `search_path
-- = public` couldn't resolve digest(), aborting every new-user insert with
-- "Database error saving new user". Re-point search_path at both schemas.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public, extensions
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

create or replace function public.handle_auth_user_phone_updated()
returns trigger
language plpgsql
security definer set search_path = public, extensions
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
