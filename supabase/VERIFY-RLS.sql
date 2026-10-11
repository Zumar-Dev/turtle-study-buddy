-- Turtle Study Buddy: verify that every user table has RLS enabled.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles','chat_threads','chat_messages','classroom_sessions','focus_sessions','learning_progress')
order by c.relname;

-- Expected: 24 policies = select/insert/update/delete for each of six tables.
select
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles','chat_threads','chat_messages','classroom_sessions','focus_sessions','learning_progress')
order by tablename, cmd, policyname;

-- Verify the automatic profile trigger exists.
select
  trigger_name,
  event_object_schema,
  event_object_table,
  action_timing,
  event_manipulation
from information_schema.triggers
where trigger_name = 'on_auth_user_created_tsb';
