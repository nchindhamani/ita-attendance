-- Add student identifier for CSV imports
alter table if exists students
  add column if not exists student_identifier text;

create unique index if not exists students_section_identifier_idx
  on students (section_id, student_identifier);


