-- Add room_number to sections
alter table if exists sections
  add column if not exists room_number text;




