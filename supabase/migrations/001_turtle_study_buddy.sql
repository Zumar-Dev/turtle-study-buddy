begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default 'Learner' check (char_length(nickname) between 1 and 32),
  age_band text check (age_band is null or age_band in ('10-12','13-15','16-17','18+')),
  main_subject text check (main_subject is null or main_subject in ('Math','Science','English','Computer Science','History','Geography','Languages','Exam Prep')),
  explanation_style text check (explanation_style is null or explanation_style in ('Step by step','Short and direct','Examples first','Visual explanation')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Study chat' check (char_length(title) between 1 and 120),
  subject text not null default 'General' check (char_length(subject) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) between 1 and 10000),
  created_at timestamptz not null default now()
);

create table if not exists public.classroom_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 1200),
  subject text not null default 'General' check (char_length(subject) between 1 and 60),
  lesson jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null default 'General' check (char_length(subject) between 1 and 60),
  goal text not null default '' check (char_length(goal) <= 300),
  planned_minutes integer check (planned_minutes is null or planned_minutes between 1 and 240),
  seconds_spent integer not null default 0 check (seconds_spent between 0 and 86400),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 60),
  topic text not null check (char_length(topic) between 1 and 160),
  status text not null default 'learning' check (status in ('learning','practicing','improving','mastered')),
  attempts integer not null default 0 check (attempts between 0 and 100000),
  last_score numeric(5,2) check (last_score is null or (last_score >= 0 and last_score <= 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, subject, topic)
);

create index if not exists chat_threads_user_updated_idx on public.chat_threads(user_id, updated_at desc);
create index if not exists chat_messages_user_thread_created_idx on public.chat_messages(user_id, thread_id, created_at);
create index if not exists classroom_sessions_user_created_idx on public.classroom_sessions(user_id, created_at desc);
create index if not exists focus_sessions_user_created_idx on public.focus_sessions(user_id, created_at desc);
create index if not exists learning_progress_user_subject_idx on public.learning_progress(user_id, subject);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists chat_threads_set_updated_at on public.chat_threads;
create trigger chat_threads_set_updated_at before update on public.chat_threads for each row execute function public.set_updated_at();
drop trigger if exists learning_progress_set_updated_at on public.learning_progress;
create trigger learning_progress_set_updated_at before update on public.learning_progress for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(user_id, nickname)
  values (new.id, 'Learner')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_tsb on auth.users;
create trigger on_auth_user_created_tsb
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.classroom_sessions enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.learning_progress enable row level security;

revoke all on table public.profiles, public.chat_threads, public.chat_messages, public.classroom_sessions, public.focus_sessions, public.learning_progress from anon;
revoke all on table public.profiles, public.chat_threads, public.chat_messages, public.classroom_sessions, public.focus_sessions, public.learning_progress from authenticated;
grant select, insert, update, delete on table public.profiles, public.chat_threads, public.chat_messages, public.classroom_sessions, public.focus_sessions, public.learning_progress to authenticated;

-- Re-create policies safely if this migration is re-run.
drop policy if exists "Profiles: select own" on public.profiles;
drop policy if exists "Profiles: insert own" on public.profiles;
drop policy if exists "Profiles: update own" on public.profiles;
drop policy if exists "Profiles: delete own" on public.profiles;
drop policy if exists "Chat threads: select own" on public.chat_threads;
drop policy if exists "Chat threads: insert own" on public.chat_threads;
drop policy if exists "Chat threads: update own" on public.chat_threads;
drop policy if exists "Chat threads: delete own" on public.chat_threads;
drop policy if exists "Chat messages: select own" on public.chat_messages;
drop policy if exists "Chat messages: insert own" on public.chat_messages;
drop policy if exists "Chat messages: update own" on public.chat_messages;
drop policy if exists "Chat messages: delete own" on public.chat_messages;
drop policy if exists "Classroom: select own" on public.classroom_sessions;
drop policy if exists "Classroom: insert own" on public.classroom_sessions;
drop policy if exists "Classroom: update own" on public.classroom_sessions;
drop policy if exists "Classroom: delete own" on public.classroom_sessions;
drop policy if exists "Focus: select own" on public.focus_sessions;
drop policy if exists "Focus: insert own" on public.focus_sessions;
drop policy if exists "Focus: update own" on public.focus_sessions;
drop policy if exists "Focus: delete own" on public.focus_sessions;
drop policy if exists "Progress: select own" on public.learning_progress;
drop policy if exists "Progress: insert own" on public.learning_progress;
drop policy if exists "Progress: update own" on public.learning_progress;
drop policy if exists "Progress: delete own" on public.learning_progress;

-- profiles
create policy "Profiles: select own" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "Profiles: insert own" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Profiles: update own" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Profiles: delete own" on public.profiles for delete to authenticated using ((select auth.uid()) = user_id);

-- chat_threads
create policy "Chat threads: select own" on public.chat_threads for select to authenticated using ((select auth.uid()) = user_id);
create policy "Chat threads: insert own" on public.chat_threads for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Chat threads: update own" on public.chat_threads for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Chat threads: delete own" on public.chat_threads for delete to authenticated using ((select auth.uid()) = user_id);

-- chat_messages: require both matching user_id and ownership of the parent thread
create policy "Chat messages: select own" on public.chat_messages for select to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.chat_threads t
    where t.id = thread_id and t.user_id = (select auth.uid())
  )
);
create policy "Chat messages: insert own" on public.chat_messages for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.chat_threads t
    where t.id = thread_id and t.user_id = (select auth.uid())
  )
);
create policy "Chat messages: update own" on public.chat_messages for update to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.chat_threads t
    where t.id = thread_id and t.user_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.chat_threads t
    where t.id = thread_id and t.user_id = (select auth.uid())
  )
);
create policy "Chat messages: delete own" on public.chat_messages for delete to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.chat_threads t
    where t.id = thread_id and t.user_id = (select auth.uid())
  )
);

-- classroom_sessions
create policy "Classroom: select own" on public.classroom_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Classroom: insert own" on public.classroom_sessions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Classroom: update own" on public.classroom_sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Classroom: delete own" on public.classroom_sessions for delete to authenticated using ((select auth.uid()) = user_id);

-- focus_sessions
create policy "Focus: select own" on public.focus_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Focus: insert own" on public.focus_sessions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Focus: update own" on public.focus_sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Focus: delete own" on public.focus_sessions for delete to authenticated using ((select auth.uid()) = user_id);

-- learning_progress
create policy "Progress: select own" on public.learning_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "Progress: insert own" on public.learning_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Progress: update own" on public.learning_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Progress: delete own" on public.learning_progress for delete to authenticated using ((select auth.uid()) = user_id);

commit;
