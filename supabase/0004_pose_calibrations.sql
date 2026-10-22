-- 0004_pose_calibrations.sql
-- Per-user pose calibration (derived measurements only, never raw video).

create table public.pose_calibrations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  exercise    text not null,
  view        text not null default 'side' check (view in ('side', 'front')),
  model_version text not null default 'mediapipe-pose-0.10.21',

  -- Suggested shape:
  -- {
  --   "limb_ratios":  { "upper_arm_to_torso": 0.62, "thigh_to_shin": 1.08, ... },
  --   "rest_pose":    { "11": [x,y,z,vis], ... },
  --   "rep_extremes": { "elbow_angle": {"min": 78, "max": 172},
  --                     "knee_angle":  {"min": 70, "max": 175} },
  --   "thresholds":   { "min_visibility": 0.45 }
  -- }
  data        jsonb not null,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, exercise, view, model_version)
);

create trigger touch_pose
  before update on public.pose_calibrations
  for each row execute function public.touch_updated_at();
