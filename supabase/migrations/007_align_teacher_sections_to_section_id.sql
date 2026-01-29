-- Align teacher_sections to use section_id only.

-- Ensure sections has room_number
alter table if exists sections
  add column if not exists room_number text;

-- Create sections for any teacher_sections rows missing section_id.
insert into sections (grade, section, room_number, school_year)
select distinct ts.grade, ts.section, ts.room_number, ts.school_year
from teacher_sections ts
left join sections s
  on s.grade = ts.grade
  and s.section = ts.section
  and s.school_year = ts.school_year
where ts.section_id is null
  and s.id is null;

-- Backfill section_id using grade/section/school_year match.
update teacher_sections ts
set section_id = s.id
from sections s
where ts.section_id is null
  and s.grade = ts.grade
  and s.section = ts.section
  and s.school_year = ts.school_year;

-- Drop old uniqueness and columns.
drop index if exists teacher_sections_teacher_grade_year_idx;

alter table if exists teacher_sections
  alter column section_id set not null;

alter table if exists teacher_sections
  drop column if exists grade,
  drop column if exists section,
  drop column if exists room_number,
  drop column if exists school_year;

create unique index if not exists teacher_sections_teacher_section_idx
  on teacher_sections (teacher_id, section_id);

