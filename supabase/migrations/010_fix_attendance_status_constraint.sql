-- Align attendance status constraint with left_early values
-- Handle both 'attendance' and 'student_attendance' table names

do $$
begin
  -- Update any legacy values (cast to text to avoid enum validation error)
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'student_attendance') then
    -- Try to update legacy 'leaving_early' values if they exist
    begin
      update student_attendance
      set status = 'left_early'::attendance_status
      where status::text = 'leaving_early';
    exception
      when others then
        -- If update fails (enum doesn't have 'leaving_early'), skip
        null;
    end;
    
    if exists (
      select 1 from information_schema.table_constraints
      where table_name = 'student_attendance'
        and constraint_name = 'student_attendance_status_check'
    ) then
      alter table student_attendance drop constraint student_attendance_status_check;
    end if;
    
    alter table student_attendance
      add constraint student_attendance_status_check
      check (status in ('present','absent','late','left_early'));
      
  elsif exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'attendance') then
    -- Try to update legacy 'leaving_early' values if they exist
    begin
      update attendance
      set status = 'left_early'::attendance_status
      where status::text = 'leaving_early';
    exception
      when others then
        -- If update fails (enum doesn't have 'leaving_early'), skip
        null;
    end;
    
    if exists (
      select 1 from information_schema.table_constraints
      where table_name = 'attendance'
        and constraint_name = 'attendance_status_check'
    ) then
      alter table attendance drop constraint attendance_status_check;
    end if;
    
    alter table attendance
      add constraint attendance_status_check
      check (status in ('present','absent','late','left_early'));
  end if;
end $$;



