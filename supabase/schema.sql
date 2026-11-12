-- =============================================================================
-- schema.sql  --  BobcatFitness Supabase database snapshot
-- =============================================================================
-- Captured 2026-11-07 from the live project (public schema + avatar storage).
-- Reflects the database AFTER the policy cleanup (duplicate / over-broad
-- policies removed). If the cleanup has not been run yet, run the DROP POLICY
-- statements from the chat first so live and this file match.
--
-- This is documentation and a rebuild reference. Keep it in sync: whenever you
-- change something in the Supabase dashboard, update this file the same day.
--
-- Not captured: numeric precisions, GRANTs, bucket size/mime limits.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null,
  bio         text,
  avatar_url  text,                          -- path in the "avatars" bucket
  weight_lbs  numeric,
  height_in   numeric,
  goal        text default 'Build Endurance',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_username_key   unique (username),
  constraint profiles_username_check check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  constraint profiles_bio_check      check (char_length(bio) <= 280)
);

-- Not used by the frontend. RLS is on with no policies, so only the service
-- role can touch it. NOTE: user_id has no ON DELETE action, so deleting an auth
-- user who owns a plan will fail until the plan is removed.
create table public.workout_plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id),
  name          text not null,
  description   text,
  duration_days integer,
  plan          jsonb not null,
  created_at    timestamptz default now()
);

-- One row per attempt at a plan. The frontend recalculates the totals itself
-- (see refreshRunProgress in workoutLog.js); there is no recount trigger.
create table public.workout_runs (
  id                  uuid not null default gen_random_uuid(),
  user_id             uuid not null default auth.uid(),
  name                text not null,
  start_date          date not null,
  end_date            date not null,
  plan_snapshot       jsonb not null default '{"days": []}'::jsonb,
  total_exercises     integer not null default 0,
  completed_exercises integer not null default 0,
  completion_pct      numeric,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  plan_id             uuid,
  status              text not null default 'in_progress',
  completed_at        timestamptz,
  constraint workouts_pkey primary key (id),
  constraint workouts_user_id_fkey foreign key (user_id)
    references public.profiles(id) on delete cascade,
  constraint workout_runs_plan_id_fkey foreign key (plan_id)
    references public.workout_plans(id),
  constraint workout_runs_status_check
    check (status = any (array['in_progress', 'completed', 'abandoned'])),
  constraint workouts_check check (end_date >= start_date)
);

create table public.workout_sets (
  id                uuid not null default gen_random_uuid(),
  user_id           uuid not null default auth.uid(),
  run_id            uuid,
  exercise          text not null,
  reps              integer not null,
  form_score        numeric,
  performed_at      timestamptz not null default now(),
  set_number        integer,
  target_reps       integer,
  plan_exercise_id  text,
  constraint workout_sets_pkey primary key (id),
  constraint workout_sets_reps_check check (reps >= 0),
  constraint workout_sets_user_id_fkey foreign key (user_id)
    references public.profiles(id) on delete cascade,
  constraint workout_sets_workout_id_fkey foreign key (run_id)
    references public.workout_runs(id) on delete set null
);


-- -----------------------------------------------------------------------------
-- Indexes (primary keys and unique constraints above create their own)
-- -----------------------------------------------------------------------------

create index workouts_user_idx     on public.workout_runs (user_id, start_date desc);
create index workout_sets_user_idx on public.workout_sets (user_id, performed_at desc);


-- -----------------------------------------------------------------------------
-- Functions
-- -----------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Creates the profile row when an auth user is created. The username comes from
-- signUp({ options: { data: { username } } }); the user_ fallback only applies
-- to users created without it (for example from the dashboard).
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

-- Signup form availability check. Returns only a boolean.
create or replace function public.username_available(p_username text)
returns boolean language sql security definer set search_path = '' stable as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(p_username)
  );
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- Login lookup. Only ever returns the synthetic address, never a real linked
-- email. REPLACE_WITH_AUTH_EMAIL_DOMAIN must be the lowercase value of
-- VITE_AUTH_EMAIL_DOMAIN (the live function must have the real domain here).
create or replace function public.login_email_for_username(p_username text)
returns text language sql stable security definer
set search_path = 'public', 'auth' as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.username) = lower(p_username)
    and lower(u.email) like '%@REPLACE_WITH_AUTH_EMAIL_DOMAIN'
  limit 1;
$$;

-- rls_auto_enable() is a Supabase-provided event trigger that turns RLS on for
-- every new table in public. It is not defined here.


-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger touch_profiles
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger touch_workouts
  before update on public.workout_runs
  for each row execute function public.touch_updated_at();


-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.workout_plans  enable row level security;   -- no policies: locked
alter table public.workout_runs   enable row level security;
alter table public.workout_sets   enable row level security;

-- Profiles are created by the signup trigger, so there is no client INSERT or
-- DELETE policy on purpose.
create policy "profiles select own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "workouts own" on public.workout_runs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- A set may only point at a run the same user owns.
create policy "sets own" on public.workout_sets
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      run_id is null
      or exists (
        select 1 from public.workout_runs w
        where w.id = workout_sets.run_id
          and w.user_id = (select auth.uid())
      )
    )
  );


-- -----------------------------------------------------------------------------
-- Storage: avatars bucket (public, so image URLs work without a SELECT policy)
-- Each user may only write inside a folder named after their own user id.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar insert own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Avatar select own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Avatar update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatar delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );


-- -----------------------------------------------------------------------------
-- Recommended, NOT yet applied
-- -----------------------------------------------------------------------------
-- Case-insensitive username uniqueness ("Alex" and "alex" must not coexist).
-- First check for existing clashes:
--   select lower(username), count(*) from public.profiles
--   group by 1 having count(*) > 1;
-- create unique index profiles_username_lower_idx
--   on public.profiles (lower(username));
