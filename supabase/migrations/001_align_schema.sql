-- Align database schema with application expectations.
-- Run this in Supabase SQL Editor after your initial tables exist.

-- Profiles: add email; align is_active default.
alter table if exists profiles
  add column if not exists email text;

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
-- Handle both 'attendance' and 'student_attendance' table names
do $$
declare
  table_name_var text;
begin
  -- Check which table exists
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'student_attendance') then
    table_name_var := 'student_attendance';
  elsif exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'attendance') then
    table_name_var := 'attendance';
  else
    -- Table doesn't exist yet, skip
    return;
  end if;

  -- Rename columns if they exist
  if exists (
    select 1 from information_schema.columns
    where table_name = table_name_var and column_name = 'date'
  ) then
    execute format('alter table %I rename column date to attendance_date', table_name_var);
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_name = table_name_var and column_name = 'marked_by'
  ) then
    execute format('alter table %I rename column marked_by to recorded_by', table_name_var);
  end if;
end $$;

-- Add school_year column (works for both table names)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'student_attendance') then
    alter table if exists student_attendance add column if not exists school_year text;
  elsif exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'attendance') then
    alter table if exists attendance add column if not exists school_year text;
  end if;
end $$;

-- Update school_year from students (works for both table names)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'student_attendance') then
    update student_attendance
    set school_year = students.school_year
    from students
    where student_attendance.student_id = students.id and student_attendance.school_year is null;
  elsif exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'attendance') then
    update attendance
    set school_year = students.school_year
    from students
    where attendance.student_id = students.id and attendance.school_year is null;
  end if;
end $$;

-- Update status values (works for both table names)
-- Note: This update is only needed if legacy 'leaving_early' values exist
-- Since the enum doesn't include 'leaving_early', we cast to text for comparison
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'student_attendance') then
    -- Only update if there are rows with text value 'leaving_early' (legacy data)
    -- Cast to text to avoid enum validation error
    update student_attendance
    set status = 'left_early'::attendance_status
    where status::text = 'leaving_early';
  elsif exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'attendance') then
    -- Only update if there are rows with text value 'leaving_early' (legacy data)
    -- Cast to text to avoid enum validation error
    update attendance
    set status = 'left_early'::attendance_status
    where status::text = 'leaving_early';
  end if;
exception
  when others then
    -- If enum doesn't allow the comparison, just skip this update
    -- (means enum is already correct and no legacy data exists)
    null;
end $$;

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

