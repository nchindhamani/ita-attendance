-- Align attendance status constraint with left_early values

-- Update any legacy values
update attendance
set status = 'left_early'
where status = 'leaving_early';

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_name = 'attendance'
      and constraint_name = 'attendance_status_check'
  ) then
    alter table attendance drop constraint attendance_status_check;
  end if;
end $$;

alter table attendance
  add constraint attendance_status_check
  check (status in ('present','absent','late','left_early'));



