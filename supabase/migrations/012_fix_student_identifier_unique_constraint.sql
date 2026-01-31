-- Fix student_identifier to be globally unique and NOT NULL
-- This migration:
-- 1. Drops the old unique index on (section_id, student_identifier)
-- 2. Checks for NULL values and fails if any exist
-- 3. Makes student_identifier NOT NULL
-- 4. Creates a new unique index on student_identifier globally

-- Step 1: Drop the existing unique index on (section_id, student_identifier)
drop index if exists students_section_identifier_idx;

-- Step 2: Check for NULL values and raise an error if any exist
do $$
declare
  null_count integer;
begin
  select count(*) into null_count
  from students
  where student_identifier is null;
  
  if null_count > 0 then
    raise exception 'Cannot make student_identifier NOT NULL: % students have NULL student_identifier. Please update these records first.', null_count;
  end if;
end $$;

-- Step 3: Make the column NOT NULL
alter table students
  alter column student_identifier set not null;

-- Step 4: Create a unique constraint on student_identifier globally
-- (No WHERE clause needed since NULLs are no longer allowed)
drop index if exists students_student_identifier_unique_idx;

create unique index if not exists students_student_identifier_unique_idx
  on students (student_identifier);

