-- Migration 025: Add volunteer role, description column, and other_staff_attendance table

-- Step 1: Add 'volunteer' to role_type enum
do $$
begin
  if not exists (
    select 1 from pg_enum 
    where enumlabel = 'volunteer' 
    and enumtypid = (select oid from pg_type where typname = 'role_type')
  ) then
    alter type role_type add value 'volunteer';
  end if;
end $$;

-- Step 2: Add 'description' column to profiles table (nullable)
alter table profiles add column if not exists description text;

-- Step 3: Create other_staff_attendance table
-- Tracks attendance for non-teacher staff (volunteers, admins, HSCP officers - not principals, not teachers)
create table if not exists other_staff_attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles(id) on delete cascade,
  attendance_date date not null,
  status attendance_status not null,  -- Uses existing enum: present, absent, late, left_early
  school_year text not null,
  comments text,
  recorded_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Unique constraint: one record per staff per date
  unique (staff_id, attendance_date)
);

-- Enable RLS for other_staff_attendance
alter table other_staff_attendance enable row level security;

-- RLS Policy: Staff can read their own attendance
drop policy if exists "Staff can read their own attendance" on other_staff_attendance;
create policy "Staff can read their own attendance"
  on other_staff_attendance
  for select
  to authenticated
  using (staff_id = auth.uid());

-- RLS Policy: Admins can read all staff attendance
drop policy if exists "Admins can read all other staff attendance" on other_staff_attendance;
create policy "Admins can read all other staff attendance"
  on other_staff_attendance
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- RLS Policy: Principals can read all staff attendance
drop policy if exists "Principals can read all other staff attendance" on other_staff_attendance;
create policy "Principals can read all other staff attendance"
  on other_staff_attendance
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'principal'
    )
  );

-- RLS Policy: Admins can insert other staff attendance
drop policy if exists "Admins can insert other staff attendance" on other_staff_attendance;
create policy "Admins can insert other staff attendance"
  on other_staff_attendance
  for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- RLS Policy: Principals can insert other staff attendance
drop policy if exists "Principals can insert other staff attendance" on other_staff_attendance;
create policy "Principals can insert other staff attendance"
  on other_staff_attendance
  for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'principal'
    )
  );

-- RLS Policy: Admins can update other staff attendance
drop policy if exists "Admins can update other staff attendance" on other_staff_attendance;
create policy "Admins can update other staff attendance"
  on other_staff_attendance
  for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- RLS Policy: Principals can update other staff attendance
drop policy if exists "Principals can update other staff attendance" on other_staff_attendance;
create policy "Principals can update other staff attendance"
  on other_staff_attendance
  for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'principal'
    )
  );

-- Create indexes for faster queries on other_staff_attendance
create index if not exists idx_other_staff_attendance_staff_id on other_staff_attendance(staff_id);
create index if not exists idx_other_staff_attendance_date on other_staff_attendance(attendance_date);
create index if not exists idx_other_staff_attendance_school_year on other_staff_attendance(school_year);
create index if not exists idx_other_staff_attendance_staff_date on other_staff_attendance(staff_id, attendance_date);

