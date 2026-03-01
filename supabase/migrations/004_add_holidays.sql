-- Add holidays table to skip attendance on non-class days
create table if not exists holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  name text not null,
  school_year text not null,
  created_at timestamptz not null default now(),
  unique (holiday_date, school_year)
);





