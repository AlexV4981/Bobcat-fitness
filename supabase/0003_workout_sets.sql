-- 0003_workout_sets.sql
-- Sets recorded from the camera page.

create table public.workout_sets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  workout_id   uuid references public.workouts(id) on delete set null,
  exercise     text not null,               -- 'Push-up' | 'Pull-up' | 'Squat' | 'Sit-up'
  reps         int  not null check (reps >= 0),
  form_score   numeric(5,2),                -- 0-100, filled in once pose scoring exists
  performed_at timestamptz not null default now()
);

create index workout_sets_user_idx on public.workout_sets(user_id, performed_at desc);
