-- Step 0: Create enum types if they don't exist
do $$
begin
  if not exists (select 1 from pg_type where typname = 'attendance_status') then
    create type attendance_status as enum ('present', 'absent', 'late', 'left_early');
  end if;
  
  if not exists (select 1 from pg_type where typname = 'role_type') then
    create type role_type as enum ('admin', 'teacher');
  end if;
  
  if not exists (select 1 from pg_type where typname = 'archive_status') then
    create type archive_status as enum ('IDLE', 'ARCHIVE_READY', 'PURGING');
  end if;
end $$;

-- Step 1: Rename attendance table to student_attendance
alter table if exists attendance rename to student_attendance;

-- Step 2: Drop and recreate RLS policies for student_attendance with new table name
-- Drop existing policies (they will be recreated with new table name)
do $$
begin
  drop policy if exists "Teachers can read attendance in their sections" on student_attendance;
  drop policy if exists "Teachers can insert attendance in their sections" on student_attendance;
  drop policy if exists "Teachers can update attendance in their sections" on student_attendance;
end $$;

-- Recreate RLS policies for student_attendance
create policy "Teachers can read attendance in their sections"
  on student_attendance
  for select
  to authenticated
  using (
    exists (
      select 1 from teacher_sections
      where teacher_sections.teacher_id = auth.uid()
        and teacher_sections.section_id = student_attendance.section_id
    )
    or exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

create policy "Teachers can insert attendance in their sections"
  on student_attendance
  for insert
  to authenticated
  with check (
    exists (
      select 1 from teacher_sections
      where teacher_sections.teacher_id = auth.uid()
        and teacher_sections.section_id = student_attendance.section_id
    )
    or exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

create policy "Teachers can update attendance in their sections"
  on student_attendance
  for update
  to authenticated
  using (
    exists (
      select 1 from teacher_sections
      where teacher_sections.teacher_id = auth.uid()
        and teacher_sections.section_id = student_attendance.section_id
    )
    or exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Step 3: Create teacher_attendance table
-- Tracks teacher attendance similar to student attendance

create table if not exists teacher_attendance (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id) on delete cascade,
  attendance_date date not null,
  status attendance_status not null,  -- Uses existing enum: present, absent, late, left_early
  school_year text not null,
  comments text,
  recorded_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Unique constraint: one record per teacher per date
  unique (teacher_id, attendance_date)
);

-- Enable RLS for teacher_attendance
alter table teacher_attendance enable row level security;

-- RLS Policy: Teachers can read their own attendance (read-only for teachers)
create policy "Teachers can read their own attendance"
  on teacher_attendance
  for select
  to authenticated
  using (teacher_id = auth.uid());

-- RLS Policy: Admins can read all teacher attendance
create policy "Admins can read all teacher attendance"
  on teacher_attendance
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- RLS Policy: Admins can insert teacher attendance for any teacher
create policy "Admins can insert teacher attendance"
  on teacher_attendance
  for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- RLS Policy: Admins can update teacher attendance for any teacher
create policy "Admins can update teacher attendance"
  on teacher_attendance
  for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Create indexes for faster queries on teacher_attendance
create index if not exists idx_teacher_attendance_teacher_id on teacher_attendance(teacher_id);
create index if not exists idx_teacher_attendance_date on teacher_attendance(attendance_date);
create index if not exists idx_teacher_attendance_school_year on teacher_attendance(school_year);
create index if not exists idx_teacher_attendance_teacher_date on teacher_attendance(teacher_id, attendance_date);
