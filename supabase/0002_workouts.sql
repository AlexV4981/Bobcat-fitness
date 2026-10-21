-- 0002_workouts.sql
-- Workout plans. The plan itself is JSON; counters are cached for lists/dashboards.

create table public.workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  start_date  date not null,
  end_date    date not null,

  -- { "days": [ { "date": "2026-09-01", "label": "Push Day",
  --     "exercises": [ { "id": "e1", "name": "...", "sets": 4, "reps": "6-8", "completed": true } ] } ] }
  plan        jsonb not null default '{"days": []}'::jsonb,

  -- Maintained by the workouts_recount trigger (see 0006); the app only edits `plan`.
  total_exercises     int not null default 0,
  completed_exercises int not null default 0,
  completion_pct      numeric(5,2) generated always as (
    case when total_exercises = 0 then 0
         else round(completed_exercises::numeric / total_exercises * 100, 2) end
  ) stored,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (end_date >= start_date)
);

create index workouts_user_idx on public.workouts(user_id, start_date desc);

create trigger touch_workouts
  before update on public.workouts
  for each row execute function public.touch_updated_at();
