-- Align database schema with application expectations.
-- Run this in Supabase SQL Editor after your initial tables exist.

-- Profiles: add email, is_approved; align is_active default.
alter table if exists profiles
  add column if not exists email text;

alter table if exists profiles
  add column if not exists is_approved boolean default false;

alter table if exists profiles
  alter column is_active set default true;

update profiles
set email = auth.users.email
from auth.users
where profiles.id = auth.users.id and profiles.email is null;

-- Sections: rename section_name -> section
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'sections' and column_name = 'section_name'
  ) then
    alter table sections rename column section_name to section;
  end if;
end $$;

-- Students: add school_year
alter table if exists students
  add column if not exists school_year text;

update students
set school_year = sections.school_year
from sections
where students.section_id = sections.id and students.school_year is null;

-- Attendance: rename date -> attendance_date, marked_by -> recorded_by
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'attendance' and column_name = 'date'
  ) then
    alter table attendance rename column date to attendance_date;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_name = 'attendance' and column_name = 'marked_by'
  ) then
    alter table attendance rename column marked_by to recorded_by;
  end if;
end $$;

alter table if exists attendance
  add column if not exists school_year text;

update attendance
set school_year = students.school_year
from students
where attendance.student_id = students.id and attendance.school_year is null;

update attendance
set status = 'left_early'
where status = 'leaving_early';

-- Teacher sections: multi-teacher support
create table if not exists teacher_sections (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles on delete cascade,
  section_id uuid not null references sections on delete cascade,
  created_at timestamptz not null default now(),
  unique (teacher_id, section_id)
);

-- System settings for archive lock
create table if not exists system_settings (
  id integer primary key default 1,
  current_school_year text not null default '2025-2026',
  archive_status text not null default 'IDLE',
  archive_path text,
  updated_at timestamptz not null default now(),
  constraint system_settings_singleton check (id = 1),
  constraint archive_status_check check (archive_status in ('IDLE','ARCHIVE_READY','PURGING'))
);

insert into system_settings (id) values (1)
on conflict (id) do nothing;

