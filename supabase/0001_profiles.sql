-- 0001_profiles.sql
-- Profiles table, profile auto-creation on signup, and the shared updated_at trigger function.
-- (Matches the SQL already run in the Supabase dashboard; 0006 revises the signup trigger.)

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null
              check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  bio         text check (char_length(bio) <= 280),
  avatar_url  text,                         -- path in the "avatars" Storage bucket
  weight_lbs  numeric(5,1),
  height_in   numeric(4,1),
  goal        text default 'Build Endurance',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    -- unique placeholder; user picks a real username on first login
    'user_' || substr(replace(new.id::text, '-', ''), 1, 10)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger touch_profiles
  before update on public.profiles
  for each row execute function public.touch_updated_at();
