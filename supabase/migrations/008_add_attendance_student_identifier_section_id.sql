-- Add student_identifier and section_id to attendance
alter table if exists attendance
  add column if not exists student_identifier integer,
  add column if not exists section_id uuid;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'attendance_section_id_fkey'
      and table_name = 'attendance'
  ) then
    alter table attendance
      add constraint attendance_section_id_fkey
      foreign key (section_id) references sections(id) on delete set null;
  end if;
end $$;

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

