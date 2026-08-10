-- Audit columns for sections and working_days.
-- API/frontend actions store the acting profile UUID.
-- Manual SQL / seed inserts omit these columns and get defaults ('backend' / now()).
-- created_at already exists on both tables.

alter table if exists sections
  add column if not exists created_by text default 'backend';

alter table if exists sections
  add column if not exists last_updated_by text default 'backend';

alter table if exists sections
  add column if not exists last_updated_at timestamptz default now();

alter table if exists working_days
  add column if not exists created_by text default 'backend';

alter table if exists working_days
  add column if not exists last_updated_by text default 'backend';

alter table if exists working_days
  add column if not exists last_updated_at timestamptz default now();

comment on column sections.created_by is
  'Profile UUID of creator (API), or backend for SQL/seed writes';
comment on column sections.last_updated_by is
  'Profile UUID of last API actor, or backend for SQL/seed writes';
comment on column sections.last_updated_at is
  'Timestamp of last insert or update';
comment on column working_days.created_by is
  'Profile UUID of creator (API), or backend for SQL/seed writes';
comment on column working_days.last_updated_by is
  'Profile UUID of last API actor, or backend for SQL/seed writes';
comment on column working_days.last_updated_at is
  'Timestamp of last insert or update';
