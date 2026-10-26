-- Run this script in Supabase Dashboard > SQL Editor.
-- The client uses only the publishable/anon key; RLS protects each user's rows.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  level integer not null default 1 check (level >= 1),
  xp integer not null default 0 check (xp >= 0),
  active_tier text not null default 'novice',
  theme_preference text not null default 'dark',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  priority text not null default 'medium',
  status text not null default 'todo',
  subtasks jsonb not null default '[]'::jsonb,
  due_date timestamptz,
  tags jsonb not null default '[]'::jsonb,
  energy_cost text not null default 'medium',
  description text not null default '',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  completion_rewarded boolean not null default false
);

create index if not exists tasks_user_id_idx on public.tasks (user_id);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "Users manage their own profile" on public.profiles;
create policy "Users manage their own profile"
  on public.profiles for all to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users manage their own tasks" on public.tasks;
create policy "Users manage their own tasks"
  on public.tasks for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.profiles, public.tasks from anon;
grant select, insert, update, delete on public.profiles, public.tasks to authenticated;

-- Create a starter profile at signup, including when email confirmation means
-- there is not yet an authenticated client session to insert the profile.
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, level, xp, active_tier, theme_preference)
  values (new.id, 1, 0, 'novice', 'dark')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();
