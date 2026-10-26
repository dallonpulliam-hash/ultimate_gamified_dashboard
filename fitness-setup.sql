-- Run this extension in Supabase Dashboard > SQL Editor after supabase-setup.sql.
-- All fitness records are private to their owner through Row Level Security.

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date timestamptz not null default now(),
  routine_name text not null,
  duration_mins integer not null default 0 check (duration_mins >= 0),
  total_volume_lbs integer not null default 0 check (total_volume_lbs >= 0),
  energy_spent text not null default 'medium',
  exercises jsonb not null default '[]'::jsonb,
  activity_type text not null default 'strength',
  cardio_activity text,
  distance numeric not null default 0 check (distance >= 0),
  distance_unit text not null default 'km'
);

alter table public.workouts add column if not exists activity_type text not null default 'strength';
alter table public.workouts add column if not exists cardio_activity text;
alter table public.workouts add column if not exists distance numeric not null default 0;
alter table public.workouts add column if not exists distance_unit text not null default 'km';

create index if not exists workouts_user_date_idx on public.workouts (user_id, date desc);

create table if not exists public.fitness_streaks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  daily_hydration_ml integer not null default 0 check (daily_hydration_ml >= 0),
  daily_protein_g integer not null default 0 check (daily_protein_g >= 0),
  last_active_date date,
  current_workout_streak integer not null default 0 check (current_workout_streak >= 0),
  daily_reset_date date not null default current_date,
  buff_claimed_date date,
  last_saved_at timestamptz not null default now(),
  custom_routines jsonb not null default '[]'::jsonb,
  neon_theme_enabled boolean not null default false
);

alter table public.workouts enable row level security;
alter table public.fitness_streaks enable row level security;

drop policy if exists "Users manage their own workouts" on public.workouts;
create policy "Users manage their own workouts"
  on public.workouts for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their own fitness streaks" on public.fitness_streaks;
create policy "Users manage their own fitness streaks"
  on public.fitness_streaks for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.workouts, public.fitness_streaks from anon;
grant select, insert, update, delete on public.workouts, public.fitness_streaks to authenticated;
