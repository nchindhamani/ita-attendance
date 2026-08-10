-- Working days allowlist (HSCP vs Regular calendars)
create table if not exists working_days (
  id uuid primary key default gen_random_uuid(),
  work_date date not null,
  school_year text not null,
  calendar_type text not null check (calendar_type in ('hscp', 'regular')),
  created_at timestamptz not null default now(),
  constraint working_days_unique unique (work_date, school_year, calendar_type)
);

create index if not exists working_days_school_year_type_idx
  on working_days (school_year, calendar_type);

create index if not exists working_days_work_date_idx
  on working_days (work_date);

alter table working_days enable row level security;

drop policy if exists "Authenticated users can read working days" on working_days;
create policy "Authenticated users can read working days"
  on working_days
  for select
  to authenticated
  using (true);
