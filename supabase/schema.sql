-- ITA Attendance Portal schema

create extension if not exists "pgcrypto";

create type role_type as enum ('admin', 'teacher');
create type attendance_status as enum ('present', 'absent', 'late', 'left_early');
create type archive_status as enum ('IDLE', 'ARCHIVE_READY', 'PURGING');

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  role role_type not null default 'teacher',
  is_active boolean not null default true,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists sections (
  id uuid primary key default gen_random_uuid(),
  grade text not null,
  section text not null,
  school_year text not null,
  created_at timestamptz not null default now()
);

create table if not exists teacher_sections (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles on delete cascade,
  section_id uuid not null references sections on delete cascade,
  created_at timestamptz not null default now(),
  unique (teacher_id, section_id)
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  section_id uuid not null references sections on delete cascade,
  school_year text not null,
  created_at timestamptz not null default now()
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students on delete cascade,
  recorded_by uuid not null references profiles on delete cascade,
  attendance_date date not null,
  status attendance_status not null,
  comments text,
  school_year text not null,
  created_at timestamptz not null default now(),
  unique (student_id, attendance_date)
);

create table if not exists system_settings (
  id integer primary key default 1,
  current_school_year text not null default '2025-2026',
  archive_status archive_status not null default 'IDLE',
  archive_path text,
  updated_at timestamptz not null default now(),
  constraint system_settings_singleton check (id = 1)
);

insert into system_settings (id) values (1)
on conflict (id) do nothing;

-- Basic Row Level Security templates (tighten for production)
alter table profiles enable row level security;
alter table sections enable row level security;
alter table teacher_sections enable row level security;
alter table students enable row level security;
alter table attendance enable row level security;
alter table system_settings enable row level security;

-- Policies are left to be refined during deployment.

