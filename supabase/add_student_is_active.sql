-- Manual apply (Supabase SQL editor) if migrations are not auto-run.
-- Same as migrations/028_student_is_active.sql

alter table students
  add column if not exists is_active boolean not null default true;

alter table students
  add column if not exists discontinued_at timestamptz;

create index if not exists idx_students_is_active
  on students (is_active);
