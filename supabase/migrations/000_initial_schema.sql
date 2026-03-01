-- Complete Initial Schema for Production Database
-- Run this FIRST in a fresh Supabase project
-- This creates all base tables, then applies all migrations

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
create extension if not exists "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================
create type role_type as enum ('admin', 'teacher', 'principal', 'attendance_officer', 'hscp_officer');
create type attendance_status as enum ('present', 'absent', 'late', 'left_early');
create type archive_status as enum ('IDLE', 'ARCHIVE_READY', 'PURGING');

-- ============================================================================
-- BASE TABLES
-- ============================================================================

-- Profiles table
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  mobile text,
  role role_type not null default 'teacher',
  grade text,
  section text,
  room_number text,
  is_active boolean not null default true,
  is_approved boolean not null default false,
  requires_password_reset boolean not null default false,
  created_at timestamptz not null default now()
);

-- Sections table
create table if not exists sections (
  id uuid primary key default gen_random_uuid(),
  grade text not null,
  section text not null,
  room_number text,
  school_year text not null,
  created_at timestamptz not null default now(),
  unique (grade, section, school_year)
);

-- Teacher sections (many-to-many)
create table if not exists teacher_sections (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles on delete cascade,
  section_id uuid not null references sections on delete cascade,
  created_at timestamptz not null default now(),
  unique (teacher_id, section_id)
);

-- Students table
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  student_identifier integer not null,
  full_name text not null,
  section_id uuid references sections on delete cascade,
  school_year text not null,
  created_at timestamptz not null default now(),
  unique (student_identifier, school_year)
);

-- Student attendance table
create table if not exists student_attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students on delete cascade,
  student_identifier integer not null,
  section_id uuid references sections on delete cascade,
  recorded_by uuid not null references profiles on delete cascade,
  attendance_date date not null,
  status attendance_status not null,
  comments text,
  school_year text not null,
  created_at timestamptz not null default now(),
  unique (student_id, attendance_date)
);

-- Teacher attendance table
create table if not exists teacher_attendance (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles on delete cascade,
  section_id uuid references sections on delete cascade,
  recorded_by uuid not null references profiles on delete cascade,
  attendance_date date not null,
  status attendance_status not null,
  comments text,
  school_year text not null,
  created_at timestamptz not null default now(),
  unique (teacher_id, attendance_date)
);

-- Holidays table
create table if not exists holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  name text not null,
  school_year text not null,
  created_at timestamptz not null default now(),
  unique (holiday_date, school_year)
);

-- System settings table
create table if not exists system_settings (
  id integer primary key default 1,
  current_school_year text not null default '2025-2026',
  archive_status archive_status not null default 'IDLE',
  archive_path text,
  updated_at timestamptz not null default now(),
  constraint system_settings_singleton check (id = 1)
);

-- Insert initial system settings
insert into system_settings (id) values (1)
on conflict (id) do nothing;

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
alter table profiles enable row level security;
alter table sections enable row level security;
alter table teacher_sections enable row level security;
alter table students enable row level security;
alter table student_attendance enable row level security;
alter table teacher_attendance enable row level security;
alter table holidays enable row level security;
alter table system_settings enable row level security;



