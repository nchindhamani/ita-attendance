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



