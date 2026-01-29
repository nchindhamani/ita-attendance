-- Update teacher_sections and students to support school-year history.

-- Teacher sections: add grade/section/room/year columns.
alter table if exists teacher_sections
  add column if not exists grade text,
  add column if not exists section text,
  add column if not exists room_number text,
  add column if not exists school_year text;

-- Allow section_id to be nullable for new logic.
alter table if exists teacher_sections
  alter column section_id drop not null;

-- Add uniqueness on teacher + grade/section + school_year.
create unique index if not exists teacher_sections_teacher_grade_year_idx
  on teacher_sections (teacher_id, grade, section, school_year);

-- Populate school_year from system_settings for any missing rows.
update teacher_sections
set school_year = (select current_school_year from system_settings where id = 1)
where school_year is null;

-- If teacher_sections rows exist and have section_id, backfill grade/section.
update teacher_sections ts
set grade = coalesce(ts.grade, s.grade),
    section = coalesce(ts.section, s.section)
from sections s
where ts.section_id = s.id;

-- Create teacher_sections rows for existing teachers with grade/section in profiles.
insert into teacher_sections (teacher_id, grade, section, room_number, school_year)
select p.id,
       p.grade,
       p.section,
       p.room_number,
       (select current_school_year from system_settings where id = 1)
from profiles p
where p.role = 'teacher'
  and p.grade is not null
  and p.section is not null
on conflict do nothing;

-- Students: add identifier, DOB, grade/section fields.
alter table if exists students
  add column if not exists student_identifier integer,
  add column if not exists date_of_birth date,
  add column if not exists grade text,
  add column if not exists section text;

-- Backfill grade/section from sections when possible.
update students st
set grade = coalesce(st.grade, s.grade),
    section = coalesce(st.section, s.section)
from sections s
where st.section_id = s.id;

-- Add uniqueness for student identifier per school year.
create unique index if not exists students_school_year_identifier_idx
  on students (school_year, student_identifier);

