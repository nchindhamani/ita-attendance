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

