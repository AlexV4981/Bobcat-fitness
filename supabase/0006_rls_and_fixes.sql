-- 0006_rls_and_fixes.sql
-- If you already created tables 0001-0005 in the dashboard, this is the ONLY file you need to run.
--
-- 1. Row Level Security on every table (was missing)
-- 2. user_id defaults so the frontend never has to send it
-- 3. Username login support (case-insensitive uniqueness, signup trigger reads the chosen
--    username, availability check, username locked after signup)
-- 4. display_name for the editable name shown in the UI
-- 5. Trigger that keeps workout counters in sync with the plan JSON

-- ---------------------------------------------------------------------------
-- 1. RLS
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.workouts          enable row level security;
alter table public.workout_sets      enable row level security;
alter table public.pose_calibrations enable row level security;

-- Profiles are created by the signup trigger (security definer), so no insert policy is needed.
create policy "profiles select own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "workouts own" on public.workouts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "pose own" on public.pose_calibrations
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Also verifies a set can only reference one of the user's own workouts.
create policy "sets own" on public.workout_sets
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      workout_id is null
      or exists (
        select 1 from public.workouts w
        where w.id = workout_id and w.user_id = (select auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2. user_id defaults
-- ---------------------------------------------------------------------------
alter table public.workouts          alter column user_id set default auth.uid();
alter table public.workout_sets      alter column user_id set default auth.uid();
alter table public.pose_calibrations alter column user_id set default auth.uid();

-- ---------------------------------------------------------------------------
-- 3. Username login support
-- ---------------------------------------------------------------------------
-- "Alex" and "alex" must not both exist (Auth lowercases the synthetic email).
create unique index profiles_username_lower_idx on public.profiles (lower(username));

-- Signup trigger now uses the username passed via signUp({ options: { data: { username } } }).
-- Falls back to a placeholder if none was supplied (e.g. a user created from the dashboard).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      'user_' || substr(replace(new.id::text, '-', ''), 1, 10)
    )
  );
  return new;
end $$;

-- Not meant to be callable through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Lets the signup form check availability before the user has an account.
-- Returns only a boolean, never profile data.
create or replace function public.username_available(p_username text)
returns boolean language sql security definer set search_path = '' stable as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(p_username)
  );
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- The username is baked into the user's login email, so it can't change after signup.
-- auth.uid() is null in the SQL editor / service role, so admins can still fix things by hand.
create or replace function public.profiles_lock_username()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and new.username is distinct from old.username then
    raise exception 'username cannot be changed';
  end if;
  return new;
end $$;

create trigger profiles_lock_username
  before update of username on public.profiles
  for each row execute function public.profiles_lock_username();

-- ---------------------------------------------------------------------------
-- 4. Editable display name
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists display_name text check (char_length(display_name) <= 50);

-- ---------------------------------------------------------------------------
-- 5. Keep workout counters in sync with the plan JSON
-- ---------------------------------------------------------------------------
create or replace function public.workouts_recount()
returns trigger language plpgsql as $$
begin
  select
    count(*),
    count(*) filter (where (e->>'completed')::boolean)
  into new.total_exercises, new.completed_exercises
  from jsonb_array_elements(coalesce(new.plan->'days', '[]'::jsonb)) d,
       jsonb_array_elements(coalesce(d->'exercises', '[]'::jsonb)) e;
  return new;
end $$;

create trigger workouts_recount
  before insert or update of plan on public.workouts
  for each row execute function public.workouts_recount();
