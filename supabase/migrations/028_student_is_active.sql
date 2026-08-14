-- Migration 028: Student active / discontinued flag
-- Soft-discontinue students who leave mid-year; keep attendance history.

alter table students
  add column if not exists is_active boolean not null default true;

alter table students
  add column if not exists discontinued_at timestamptz;

comment on column students.is_active is
  'False when student has left/discontinued; excluded from mark-attendance lists.';

comment on column students.discontinued_at is
  'When the student was marked discontinued; null if active.';

create index if not exists idx_students_is_active
  on students (is_active);
