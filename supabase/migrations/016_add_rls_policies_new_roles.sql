-- RLS Policies for New Roles: Principal, Attendance Officer, HSCP Officer

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

