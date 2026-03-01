-- Add student_identifier and section_id to attendance/student_attendance
-- Handle both table names
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'student_attendance') then
    alter table if exists student_attendance
      add column if not exists student_identifier integer,
      add column if not exists section_id uuid;
    
    if not exists (
      select 1 from information_schema.table_constraints
      where constraint_name = 'student_attendance_section_id_fkey'
        and table_name = 'student_attendance'
    ) then
      alter table student_attendance
        add constraint student_attendance_section_id_fkey
        foreign key (section_id) references sections(id) on delete set null;
    end if;
    
    -- Backfill section_id and student_identifier from students
    update student_attendance a
    set section_id = s.section_id,
        student_identifier = nullif(s.student_identifier::text, '')::integer
    from students s
    where a.student_id = s.id
      and (a.section_id is null or a.student_identifier is null);
    
    -- Optional index for faster student/year lookups
    create index if not exists student_attendance_student_identifier_year_idx
      on student_attendance (student_identifier, school_year);
      
  elsif exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'attendance') then
    alter table if exists attendance
      add column if not exists student_identifier integer,
      add column if not exists section_id uuid;
    
    if not exists (
      select 1 from information_schema.table_constraints
      where constraint_name = 'attendance_section_id_fkey'
        and table_name = 'attendance'
    ) then
      alter table attendance
        add constraint attendance_section_id_fkey
        foreign key (section_id) references sections(id) on delete set null;
    end if;
    
    -- Backfill section_id and student_identifier from students
    update attendance a
    set section_id = s.section_id,
        student_identifier = nullif(s.student_identifier::text, '')::integer
    from students s
    where a.student_id = s.id
      and (a.section_id is null or a.student_identifier is null);
    
    -- Optional index for faster student/year lookups
    create index if not exists attendance_student_identifier_year_idx
      on attendance (student_identifier, school_year);
  end if;
end $$;

