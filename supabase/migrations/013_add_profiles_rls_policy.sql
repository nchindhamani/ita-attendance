-- Add RLS policies for all tables used by the Python API
-- This is required for authenticated users to query data with RLS enabled

-- ============================================
-- PROFILES TABLE
-- ============================================
-- Policy: Users can read their own profile
create policy "Users can read their own profile"
  on profiles
  for select
  using (auth.uid() = id);

-- Policy: Users can update their own profile (if needed)
create policy "Users can update their own profile"
  on profiles
  for update
  using (auth.uid() = id);

-- ============================================
-- HOLIDAYS TABLE
-- ============================================
-- Policy: All authenticated users can read holidays (public data)
create policy "Authenticated users can read holidays"
  on holidays
  for select
  to authenticated
  using (true);

-- ============================================
-- STUDENTS TABLE
-- ============================================
-- Policy: Teachers can read students in their assigned sections
create policy "Teachers can read students in their sections"
  on students
  for select
  to authenticated
  using (
    exists (
      select 1 from teacher_sections
      where teacher_sections.teacher_id = auth.uid()
        and teacher_sections.section_id = students.section_id
    )
    or exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- ============================================
-- ATTENDANCE TABLE (student_attendance or attendance)
-- ============================================
-- Policy: Teachers can read attendance for their sections
-- Handle both table names
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'student_attendance') then
    -- Create policies for student_attendance
    if not exists (
      select 1 from pg_policies 
      where schemaname = 'public' 
      and tablename = 'student_attendance' 
      and policyname = 'Teachers can read attendance in their sections'
    ) then
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
    end if;
    
    if not exists (
      select 1 from pg_policies 
      where schemaname = 'public' 
      and tablename = 'student_attendance' 
      and policyname = 'Teachers can insert attendance in their sections'
    ) then
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
    end if;
    
    if not exists (
      select 1 from pg_policies 
      where schemaname = 'public' 
      and tablename = 'student_attendance' 
      and policyname = 'Teachers can update attendance in their sections'
    ) then
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
    end if;
  elsif exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'attendance') then
    -- Create policies for attendance (will be renamed later)
    if not exists (
      select 1 from pg_policies 
      where schemaname = 'public' 
      and tablename = 'attendance' 
      and policyname = 'Teachers can read attendance in their sections'
    ) then
      create policy "Teachers can read attendance in their sections"
        on attendance
        for select
        to authenticated
        using (
          exists (
            select 1 from teacher_sections
            where teacher_sections.teacher_id = auth.uid()
              and teacher_sections.section_id = attendance.section_id
          )
          or exists (
            select 1 from profiles
            where profiles.id = auth.uid()
              and profiles.role = 'admin'
          )
        );
    end if;
    
    if not exists (
      select 1 from pg_policies 
      where schemaname = 'public' 
      and tablename = 'attendance' 
      and policyname = 'Teachers can insert attendance in their sections'
    ) then
      create policy "Teachers can insert attendance in their sections"
        on attendance
        for insert
        to authenticated
        with check (
          exists (
            select 1 from teacher_sections
            where teacher_sections.teacher_id = auth.uid()
              and teacher_sections.section_id = attendance.section_id
          )
          or exists (
            select 1 from profiles
            where profiles.id = auth.uid()
              and profiles.role = 'admin'
          )
        );
    end if;
    
    if not exists (
      select 1 from pg_policies 
      where schemaname = 'public' 
      and tablename = 'attendance' 
      and policyname = 'Teachers can update attendance in their sections'
    ) then
      create policy "Teachers can update attendance in their sections"
        on attendance
        for update
        to authenticated
        using (
          exists (
            select 1 from teacher_sections
            where teacher_sections.teacher_id = auth.uid()
              and teacher_sections.section_id = attendance.section_id
          )
          or exists (
            select 1 from profiles
            where profiles.id = auth.uid()
              and profiles.role = 'admin'
          )
        );
    end if;
  end if;
end $$;

-- ============================================
-- SECTIONS TABLE
-- ============================================
-- Policy: Teachers can read their assigned sections
create policy "Teachers can read their sections"
  on sections
  for select
  to authenticated
  using (
    exists (
      select 1 from teacher_sections
      where teacher_sections.teacher_id = auth.uid()
        and teacher_sections.section_id = sections.id
    )
    or exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- ============================================
-- TEACHER_SECTIONS TABLE
-- ============================================
-- Policy: Teachers can read their own assignments
create policy "Teachers can read their section assignments"
  on teacher_sections
  for select
  to authenticated
  using (
    teacher_sections.teacher_id = auth.uid()
    or exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

