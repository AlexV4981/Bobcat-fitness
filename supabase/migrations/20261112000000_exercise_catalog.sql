-- =====================================================================
-- Exercise catalog
--   exercises        imported (free-exercise-db) + custom exercises
--   workout_sets     gains exercise_id (the old `exercise` text stays as a name snapshot)
--   storage bucket   exercise-images (optional mirror of the dataset's photos)
--
-- Ownership rule: the sync job only writes the "source-owned" columns.
-- guide_key, tracker_name, is_active and anything you add yourself are never touched by it.
-- =====================================================================

create table public.exercises (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,               -- stable key, e.g. 'push-up' or 'Alternate_Incline_Dumbbell_Curl'
  source            text not null default 'custom',     -- 'custom' | 'free-exercise-db'
  source_hash       text,                               -- sync skips rows whose hash is unchanged
  deprecated        boolean not null default false,     -- set by sync when an exercise disappears upstream

  -- source-owned (overwritten by sync)
  name              text not null,
  category          text,                               -- dataset category: strength, stretching, cardio...
  movement          text check (movement in ('Push','Pull','Legs','Core','Other')),
  level             text check (level in ('Beginner','Intermediate','Advanced')),
  force_type        text,                               -- push | pull | static
  mechanic          text,                               -- compound | isolation
  equipment         text[] not null default '{}',      -- empty = bodyweight
  primary_muscles   text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  instructions      text[] not null default '{}',
  source_images     text[] not null default '{}',      -- paths relative to the dataset's exercises/ folder

  -- yours (never touched by sync)
  summary           text,
  mirrored_images   text[] not null default '{}',      -- full URLs in our own storage bucket (filled by sync-exercises?mode=images)
  guide_key         text,                               -- which frontend form-guide animation to show (guideRegistry.js)
  tracker_name      text,                               -- exact name the Python rep counter accepts; non-null = camera-trackable
  is_active         boolean not null default true,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index exercises_tracker_name_key on public.exercises (tracker_name) where tracker_name is not null;
create index exercises_source_idx on public.exercises (source);

create or replace function public.exercises_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger exercises_updated_at
  before update on public.exercises
  for each row execute function public.exercises_set_updated_at();

-- Readable by everyone (signed in or not); writable only by the service role,
-- which bypasses RLS. No insert/update/delete policies on purpose.
alter table public.exercises enable row level security;
create policy "exercises are readable" on public.exercises for select using (true);

-- Public bucket for mirrored exercise photos (writes come from the service role only).
insert into storage.buckets (id, name, public)
values ('exercise-images', 'exercise-images', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Seed: the four exercises that used to be hardcoded in ExerciseCatalog.js
-- ---------------------------------------------------------------------
insert into public.exercises
  (slug, source, name, category, movement, level, equipment, primary_muscles, secondary_muscles, summary, guide_key, tracker_name)
values
  ('push-up', 'custom', 'Push-Up', 'strength', 'Push', 'Beginner', '{}',
   '{Chest,Triceps}', '{"Front shoulders",Core}',
   'A bodyweight press that builds the chest, shoulders and triceps while the core holds a rigid plank. Easy to scale by changing how high your hands are.',
   'push-up', 'Push-Up'),
  ('pull-up', 'custom', 'Pull-Up', 'strength', 'Pull', 'Intermediate', '{"Pull-up bar"}',
   '{Lats,Biceps}', '{"Upper back",Forearms}',
   'A bodyweight vertical pull that works the lats and upper back, with the biceps and grip helping. Controlled reps from a full hang matter more than the count.',
   'pull-up', 'Pull-Up'),
  ('back-squat', 'custom', 'Barbell Back Squat', 'strength', 'Legs', 'Intermediate', '{Barbell,"Squat rack"}',
   '{Quadriceps,Glutes}', '{Hamstrings,Core,"Lower back"}',
   'A barbell squat that loads the legs and hips with the bar across your upper back. Depth, a braced torso and a bar path over mid-foot are the keys.',
   'squat', 'Squat'),
  ('sit-up', 'custom', 'Sit-Up', 'strength', 'Core', 'Beginner', '{}',
   '{Abs}', '{"Hip flexors"}',
   'A bodyweight trunk curl that trains the abs through a full range, from lying down to upright. Keep your feet anchored and your neck relaxed.',
   'sit-up', 'Sit-Up')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Link logged sets to exercises
-- ---------------------------------------------------------------------
alter table public.workout_sets
  add column exercise_id uuid references public.exercises(id) on delete set null;
create index workout_sets_exercise_id_idx on public.workout_sets (exercise_id);

-- Backfill: match old free-text names ("Push-Up", "Push-up", "Squat") to the seeded rows.
update public.workout_sets s
set exercise_id = e.id
from public.exercises e
where s.exercise_id is null
  and e.source = 'custom'
  and regexp_replace(lower(s.exercise), '[^a-z]', '', 'g') in (
        regexp_replace(lower(e.name), '[^a-z]', '', 'g'),
        regexp_replace(lower(coalesce(e.tracker_name, e.name)), '[^a-z]', '', 'g')
      );

-- Check what didn't match (run manually):
--   select exercise, count(*) from public.workout_sets where exercise_id is null group by 1 order by 2 desc;

-- ---------------------------------------------------------------------
-- OPTIONAL, run after the first import: hide the imported duplicates of your four exercises.
-- First look at what the dataset calls them, then fill in the slugs you find:
--   select slug, name from public.exercises
--   where source = 'free-exercise-db' and name ilike any (array['%push%up%','%pull%up%','%squat%','%sit%up%','%crunch%']);
--
--   update public.exercises set is_active = false
--   where source = 'free-exercise-db' and slug in ('<slug1>', '<slug2>');
-- ---------------------------------------------------------------------
