-- Add is_approved back to profiles for approval flow
alter table if exists profiles
  add column if not exists is_approved boolean default false;


