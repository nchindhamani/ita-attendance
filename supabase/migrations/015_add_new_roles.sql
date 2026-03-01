-- Add new roles to role_type enum
-- PostgreSQL doesn't support ADD VALUE IF NOT EXISTS, so we check first

do $$
begin
  -- Check if principal role exists
  if not exists (
    select 1 from pg_enum 
    where enumlabel = 'principal' 
    and enumtypid = (select oid from pg_type where typname = 'role_type')
  ) then
    alter type role_type add value 'principal';
  end if;

  -- Check if attendance_officer role exists
  if not exists (
    select 1 from pg_enum 
    where enumlabel = 'attendance_officer' 
    and enumtypid = (select oid from pg_type where typname = 'role_type')
  ) then
    alter type role_type add value 'attendance_officer';
  end if;

  -- Check if hscp_officer role exists
  if not exists (
    select 1 from pg_enum 
    where enumlabel = 'hscp_officer' 
    and enumtypid = (select oid from pg_type where typname = 'role_type')
  ) then
    alter type role_type add value 'hscp_officer';
  end if;
end $$;

