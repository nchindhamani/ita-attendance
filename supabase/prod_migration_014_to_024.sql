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
  drop policy if exists "Principals can read all student attendance" on student_attendance;
  drop policy if exists "Attendance Officers can read all student attendance" on student_attendance;
  drop policy if exists "Attendance Officers can insert all student attendance" on student_attendance;
  drop policy if exists "Attendance Officers can update all student attendance" on student_attendance;
  drop policy if exists "HSCP Officers can read HSCP student attendance" on student_attendance;
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

-- Drop existing teacher_attendance policies if they exist (for idempotency)
drop policy if exists "Teachers can read their own attendance" on teacher_attendance;
drop policy if exists "Admins can read all teacher attendance" on teacher_attendance;
drop policy if exists "Admins can insert teacher attendance" on teacher_attendance;
drop policy if exists "Admins can update teacher attendance" on teacher_attendance;
drop policy if exists "Principals can read all teacher attendance" on teacher_attendance;
drop policy if exists "HSCP Officers can read HSCP teacher attendance" on teacher_attendance;
drop policy if exists "HSCP Officers can insert HSCP teacher attendance" on teacher_attendance;
drop policy if exists "HSCP Officers can update HSCP teacher attendance" on teacher_attendance;

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
-- Add new roles to role_type enum
-- PostgreSQL doesn't support ADD VALUE IF NOT EXISTS, so we check first

do $$
begin
  -- Check if principal role exists
  if not exists (
    select 1 from pg_enum 
    where enumlabel = 'principal' 
    and enumtypid = (select oid from pg_type where typname = 'role_type')
  ) then
    alter type role_type add value 'principal';
  end if;

  -- Check if attendance_officer role exists
  if not exists (
    select 1 from pg_enum 
    where enumlabel = 'attendance_officer' 
    and enumtypid = (select oid from pg_type where typname = 'role_type')
  ) then
    alter type role_type add value 'attendance_officer';
  end if;

  -- Check if hscp_officer role exists
  if not exists (
    select 1 from pg_enum 
    where enumlabel = 'hscp_officer' 
    and enumtypid = (select oid from pg_type where typname = 'role_type')
  ) then
    alter type role_type add value 'hscp_officer';
  end if;
end $$;

-- RLS Policies for New Roles: Principal, Attendance Officer, HSCP Officer
-- Drop all existing policies from migration 016 for idempotency

-- Principal policies
drop policy if exists "Principals can read all student attendance" on student_attendance;
drop policy if exists "Principals can read all teacher attendance" on teacher_attendance;
drop policy if exists "Principals can read all profiles" on profiles;
drop policy if exists "Principals can read all students" on students;
drop policy if exists "Principals can read all sections" on sections;

-- Attendance Officer policies
drop policy if exists "Attendance Officers can read all students" on students;
drop policy if exists "Attendance Officers can read all student attendance" on student_attendance;
drop policy if exists "Attendance Officers can insert all student attendance" on student_attendance;
drop policy if exists "Attendance Officers can update all student attendance" on student_attendance;
drop policy if exists "Attendance Officers can read all sections" on sections;

-- HSCP Officer policies
drop policy if exists "HSCP Officers can read HSCP teacher attendance" on teacher_attendance;
drop policy if exists "HSCP Officers can insert HSCP teacher attendance" on teacher_attendance;
drop policy if exists "HSCP Officers can update HSCP teacher attendance" on teacher_attendance;
drop policy if exists "HSCP Officers can read HSCP student attendance" on student_attendance;
drop policy if exists "HSCP Officers can read HSCP students" on students;
drop policy if exists "HSCP Officers can read HSCP sections" on sections;
drop policy if exists "HSCP Officers can read HSCP teacher profiles" on profiles;

-- ============================================================================
-- PRINCIPAL POLICIES (Read-only access to all data)
-- ============================================================================

-- Principal can read all student attendance
create policy "Principals can read all student attendance"
  on student_attendance
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'principal'
    )
  );

-- Principal can read all teacher attendance
create policy "Principals can read all teacher attendance"
  on teacher_attendance
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'principal'
    )
  );

-- Principal can read all user profiles
create policy "Principals can read all profiles"
  on profiles
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'principal'
    )
    or id = auth.uid()  -- Users can always read their own profile
  );

-- Principal can read all students
create policy "Principals can read all students"
  on students
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'principal'
    )
  );

-- Principal can read all sections
create policy "Principals can read all sections"
  on sections
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'principal'
    )
  );

-- ============================================================================
-- ATTENDANCE OFFICER POLICIES
-- ============================================================================

-- Attendance Officer can read all students (read-only)
create policy "Attendance Officers can read all students"
  on students
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'attendance_officer'
    )
  );

-- Attendance Officer can read all student attendance
create policy "Attendance Officers can read all student attendance"
  on student_attendance
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'attendance_officer'
    )
  );

-- Attendance Officer can insert student attendance (all sections)
create policy "Attendance Officers can insert all student attendance"
  on student_attendance
  for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'attendance_officer'
    )
  );

-- Attendance Officer can update student attendance (all sections)
create policy "Attendance Officers can update all student attendance"
  on student_attendance
  for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'attendance_officer'
    )
  );

-- Attendance Officer can read all sections
create policy "Attendance Officers can read all sections"
  on sections
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'attendance_officer'
    )
  );

-- ============================================================================
-- HSCP OFFICER POLICIES
-- ============================================================================

-- HSCP Officer can read teacher attendance for HSCP teachers
-- (teachers assigned to sections with grade starting with 'HSCP-')
create policy "HSCP Officers can read HSCP teacher attendance"
  on teacher_attendance
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'hscp_officer'
    )
    and exists (
      select 1 from teacher_sections ts
      join sections s on s.id = ts.section_id
      where ts.teacher_id = teacher_attendance.teacher_id
        and s.grade like 'HSCP-%'
    )
  );

-- HSCP Officer can insert teacher attendance for HSCP teachers
create policy "HSCP Officers can insert HSCP teacher attendance"
  on teacher_attendance
  for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'hscp_officer'
    )
    and exists (
      select 1 from teacher_sections ts
      join sections s on s.id = ts.section_id
      where ts.teacher_id = teacher_attendance.teacher_id
        and s.grade like 'HSCP-%'
    )
  );

-- HSCP Officer can update teacher attendance for HSCP teachers
create policy "HSCP Officers can update HSCP teacher attendance"
  on teacher_attendance
  for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'hscp_officer'
    )
    and exists (
      select 1 from teacher_sections ts
      join sections s on s.id = ts.section_id
      where ts.teacher_id = teacher_attendance.teacher_id
        and s.grade like 'HSCP-%'
    )
  );

-- HSCP Officer can read student attendance for HSCP sections (read-only)
create policy "HSCP Officers can read HSCP student attendance"
  on student_attendance
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'hscp_officer'
    )
    and exists (
      select 1 from sections s
      where s.id = student_attendance.section_id
        and s.grade like 'HSCP-%'
    )
  );

-- HSCP Officer can read students in HSCP sections
create policy "HSCP Officers can read HSCP students"
  on students
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'hscp_officer'
    )
    and (
      students.section_id is null
      or exists (
        select 1 from sections s
        where s.id = students.section_id
          and s.grade like 'HSCP-%'
      )
    )
  );

-- HSCP Officer can read HSCP sections
create policy "HSCP Officers can read HSCP sections"
  on sections
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'hscp_officer'
    )
    and sections.grade like 'HSCP-%'
  );

-- HSCP Officer can read profiles of HSCP teachers
create policy "HSCP Officers can read HSCP teacher profiles"
  on profiles
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'hscp_officer'
    )
    and (
      id = auth.uid()  -- Users can always read their own profile
      or exists (
        select 1 from teacher_sections ts
        join sections s on s.id = ts.section_id
        where ts.teacher_id = profiles.id
          and s.grade like 'HSCP-%'
      )
    )
  );

-- Add requires_password_reset column to profiles table
-- This flag indicates that the user must reset their password on first login

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS requires_password_reset BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN profiles.requires_password_reset IS 'Set to true when user is created with temporary password or when placeholder email is updated to valid email. User must reset password on first login.';



-- Fix infinite recursion in profiles RLS policy
-- The issue occurs when policies on other tables query profiles to check admin role
-- This creates a circular dependency

-- Drop ALL existing policies on profiles to start fresh
DROP POLICY IF EXISTS "Users can read their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Create a SECURITY DEFINER function to get user role without triggering RLS
-- This function bypasses RLS to avoid recursion
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN (SELECT role::text FROM profiles WHERE id = user_id LIMIT 1);
END;
$$;

-- Simple policy: Users can read their own profile
-- This is the most basic policy that shouldn't cause recursion
CREATE POLICY "Users can read their own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Admins can read all profiles (for admin dashboard)
-- Uses the SECURITY DEFINER function to avoid recursion
CREATE POLICY "Admins can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id  -- Users can always read their own profile
    OR public.get_user_role(auth.uid()) = 'admin'  -- Admins can read all profiles
  );

-- Policy: Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id  -- Users can update their own profile
    OR public.get_user_role(auth.uid()) = 'admin'  -- Admins can update all profiles
  )
  WITH CHECK (
    auth.uid() = id  -- Users can only update their own profile
    OR public.get_user_role(auth.uid()) = 'admin'  -- Admins can update any profile
  );

-- Simplify profiles RLS to fix infinite recursion
-- Remove all policies and recreate with the simplest possible approach

-- Drop ALL existing policies on profiles
DROP POLICY IF EXISTS "Users can read their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Drop the function if it exists
DROP FUNCTION IF EXISTS public.get_user_role(uuid);

-- SIMPLEST APPROACH: Just allow users to read/update their own profile
-- For admin access to all profiles, we'll handle it via backend API with service role
CREATE POLICY "Users can read their own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Note: Admin access to all profiles will be handled via:
-- 1. Backend API using service_role key (bypasses RLS)
-- 2. Or we can add admin policies later using a different approach



-- Fix infinite recursion by replacing all direct profiles queries with functions
-- These functions bypass RLS to avoid recursion

-- Create functions to check user roles (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND role = 'admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_principal(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND role = 'principal'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_attendance_officer(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND role = 'attendance_officer'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_hscp_officer(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND role = 'hscp_officer'
  );
END;
$$;

-- Now update all policies that query profiles directly
-- We'll drop and recreate them to use the function instead

-- ============================================
-- STUDENTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Teachers can read students in their sections" ON students;
CREATE POLICY "Teachers can read students in their sections"
  ON students
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teacher_sections
      WHERE teacher_sections.teacher_id = auth.uid()
        AND teacher_sections.section_id = students.section_id
    )
    OR public.is_admin()  -- Use function instead of direct query
  );

-- ============================================
-- ATTENDANCE TABLE (student_attendance)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_attendance') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Teachers can read attendance in their sections" ON student_attendance;
    DROP POLICY IF EXISTS "Teachers can insert attendance in their sections" ON student_attendance;
    DROP POLICY IF EXISTS "Teachers can update attendance in their sections" ON student_attendance;
    
    -- Recreate with function
    CREATE POLICY "Teachers can read attendance in their sections"
      ON student_attendance
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM teacher_sections
          WHERE teacher_sections.teacher_id = auth.uid()
            AND teacher_sections.section_id = student_attendance.section_id
        )
        OR public.is_admin()
      );
    
    CREATE POLICY "Teachers can insert attendance in their sections"
      ON student_attendance
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM teacher_sections
          WHERE teacher_sections.teacher_id = auth.uid()
            AND teacher_sections.section_id = student_attendance.section_id
        )
        OR public.is_admin()
      );
    
    CREATE POLICY "Teachers can update attendance in their sections"
      ON student_attendance
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM teacher_sections
          WHERE teacher_sections.teacher_id = auth.uid()
            AND teacher_sections.section_id = student_attendance.section_id
        )
        OR public.is_admin()
      );
  END IF;
END $$;

-- ============================================
-- SECTIONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Teachers can read their sections" ON sections;
CREATE POLICY "Teachers can read their sections"
  ON sections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teacher_sections
      WHERE teacher_sections.teacher_id = auth.uid()
        AND teacher_sections.section_id = sections.id
    )
    OR public.is_admin()
  );

-- ============================================
-- TEACHER_SECTIONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Teachers can read their section assignments" ON teacher_sections;
CREATE POLICY "Teachers can read their section assignments"
  ON teacher_sections
  FOR SELECT
  TO authenticated
  USING (
    teacher_sections.teacher_id = auth.uid()
    OR public.is_admin()
  );

-- COMPLETE FIX: Replace ALL direct profiles queries with functions
-- This fixes infinite recursion in RLS policies

-- ============================================
-- STEP 1: Create helper functions (bypass RLS)
-- ============================================

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND role = 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_principal(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND role = 'principal');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_attendance_officer(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND role = 'attendance_officer');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_hscp_officer(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND role = 'hscp_officer');
END;
$$;

-- ============================================
-- STEP 2: Fix PROFILES policies (from migration 016)
-- ============================================

-- Drop problematic Principal policy that queries profiles
DROP POLICY IF EXISTS "Principals can read all profiles" ON profiles;

-- Recreate without recursion
CREATE POLICY "Principals can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()  -- Users can always read their own profile
    OR public.is_principal()  -- Principals can read all profiles
  );

-- Drop HSCP Officer profile policy
DROP POLICY IF EXISTS "HSCP Officers can read HSCP teacher profiles" ON profiles;

-- Recreate without recursion
CREATE POLICY "HSCP Officers can read HSCP teacher profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()  -- Users can always read their own profile
    OR (
      public.is_hscp_officer()
      AND EXISTS (
        SELECT 1 FROM teacher_sections ts
        JOIN sections s ON s.id = ts.section_id
        WHERE ts.teacher_id = profiles.id
          AND s.grade LIKE 'HSCP-%'
      )
    )
  );

-- ============================================
-- STEP 3: Fix all other policies from migration 016
-- ============================================

-- Principal policies
DROP POLICY IF EXISTS "Principals can read all student attendance" ON student_attendance;
CREATE POLICY "Principals can read all student attendance"
  ON student_attendance FOR SELECT TO authenticated
  USING (public.is_principal());

DROP POLICY IF EXISTS "Principals can read all teacher attendance" ON teacher_attendance;
CREATE POLICY "Principals can read all teacher attendance"
  ON teacher_attendance FOR SELECT TO authenticated
  USING (public.is_principal());

DROP POLICY IF EXISTS "Principals can read all students" ON students;
CREATE POLICY "Principals can read all students"
  ON students FOR SELECT TO authenticated
  USING (public.is_principal());

DROP POLICY IF EXISTS "Principals can read all sections" ON sections;
CREATE POLICY "Principals can read all sections"
  ON sections FOR SELECT TO authenticated
  USING (public.is_principal());

-- Attendance Officer policies
DROP POLICY IF EXISTS "Attendance Officers can read all students" ON students;
CREATE POLICY "Attendance Officers can read all students"
  ON students FOR SELECT TO authenticated
  USING (public.is_attendance_officer());

DROP POLICY IF EXISTS "Attendance Officers can read all student attendance" ON student_attendance;
CREATE POLICY "Attendance Officers can read all student attendance"
  ON student_attendance FOR SELECT TO authenticated
  USING (public.is_attendance_officer());

DROP POLICY IF EXISTS "Attendance Officers can insert all student attendance" ON student_attendance;
CREATE POLICY "Attendance Officers can insert all student attendance"
  ON student_attendance FOR INSERT TO authenticated
  WITH CHECK (public.is_attendance_officer());

DROP POLICY IF EXISTS "Attendance Officers can update all student attendance" ON student_attendance;
CREATE POLICY "Attendance Officers can update all student attendance"
  ON student_attendance FOR UPDATE TO authenticated
  USING (public.is_attendance_officer());

DROP POLICY IF EXISTS "Attendance Officers can read all sections" ON sections;
CREATE POLICY "Attendance Officers can read all sections"
  ON sections FOR SELECT TO authenticated
  USING (public.is_attendance_officer());

-- HSCP Officer policies
DROP POLICY IF EXISTS "HSCP Officers can read HSCP teacher attendance" ON teacher_attendance;
CREATE POLICY "HSCP Officers can read HSCP teacher attendance"
  ON teacher_attendance FOR SELECT TO authenticated
  USING (
    public.is_hscp_officer()
    AND EXISTS (
      SELECT 1 FROM teacher_sections ts
      JOIN sections s ON s.id = ts.section_id
      WHERE ts.teacher_id = teacher_attendance.teacher_id
        AND s.grade LIKE 'HSCP-%'
    )
  );

DROP POLICY IF EXISTS "HSCP Officers can insert HSCP teacher attendance" ON teacher_attendance;
CREATE POLICY "HSCP Officers can insert HSCP teacher attendance"
  ON teacher_attendance FOR INSERT TO authenticated
  WITH CHECK (
    public.is_hscp_officer()
    AND EXISTS (
      SELECT 1 FROM teacher_sections ts
      JOIN sections s ON s.id = ts.section_id
      WHERE ts.teacher_id = teacher_attendance.teacher_id
        AND s.grade LIKE 'HSCP-%'
    )
  );

DROP POLICY IF EXISTS "HSCP Officers can update HSCP teacher attendance" ON teacher_attendance;
CREATE POLICY "HSCP Officers can update HSCP teacher attendance"
  ON teacher_attendance FOR UPDATE TO authenticated
  USING (
    public.is_hscp_officer()
    AND EXISTS (
      SELECT 1 FROM teacher_sections ts
      JOIN sections s ON s.id = ts.section_id
      WHERE ts.teacher_id = teacher_attendance.teacher_id
        AND s.grade LIKE 'HSCP-%'
    )
  );

DROP POLICY IF EXISTS "HSCP Officers can read HSCP student attendance" ON student_attendance;
CREATE POLICY "HSCP Officers can read HSCP student attendance"
  ON student_attendance FOR SELECT TO authenticated
  USING (
    public.is_hscp_officer()
    AND EXISTS (
      SELECT 1 FROM sections s
      WHERE s.id = student_attendance.section_id
        AND s.grade LIKE 'HSCP-%'
    )
  );

DROP POLICY IF EXISTS "HSCP Officers can read HSCP students" ON students;
CREATE POLICY "HSCP Officers can read HSCP students"
  ON students FOR SELECT TO authenticated
  USING (
    public.is_hscp_officer()
    AND (
      students.section_id IS NULL
      OR EXISTS (
        SELECT 1 FROM sections s
        WHERE s.id = students.section_id
          AND s.grade LIKE 'HSCP-%'
      )
    )
  );

DROP POLICY IF EXISTS "HSCP Officers can read HSCP sections" ON sections;
CREATE POLICY "HSCP Officers can read HSCP sections"
  ON sections FOR SELECT TO authenticated
  USING (
    public.is_hscp_officer()
    AND sections.grade LIKE 'HSCP-%'
  );

-- ============================================
-- STEP 4: Fix policies from migration 013 (already in 020, but ensure they're applied)
-- ============================================

-- These should already be fixed by migration 020, but ensure they use functions
-- (The migration 020 script handles students, student_attendance, sections, teacher_sections)



-- Update unique constraint on student_attendance to allow multiple records per student per day
-- This is needed for HSCP grades where students can have separate attendance for Reading, Writing, and Conversation

-- Drop the old unique constraint (try both possible names)
alter table if exists student_attendance 
drop constraint if exists student_attendance_student_id_attendance_date_key;

alter table if exists student_attendance 
drop constraint if exists attendance_student_id_date_key;

-- Add new unique constraint that includes section_id (only if it doesn't exist)
-- This allows a student to have multiple attendance records per day (one per section)
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'student_attendance_student_id_attendance_date_section_id_key'
  ) then
    alter table student_attendance 
    add constraint student_attendance_student_id_attendance_date_section_id_key 
    unique (student_id, attendance_date, section_id);
    
    comment on constraint student_attendance_student_id_attendance_date_section_id_key on student_attendance is 
    'Allows students to have separate attendance records per section per day. Required for HSCP grades where students have separate attendance for Reading, Writing, and Conversation.';
  end if;
end $$;

