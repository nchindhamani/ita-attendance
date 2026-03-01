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

