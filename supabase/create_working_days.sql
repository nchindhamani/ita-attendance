-- =============================================================================
-- Working Days table
-- Run this in Supabase SQL Editor.
-- =============================================================================
-- Stores class/working days for each school year and calendar type.
-- calendar_type:
--   'hscp'    = HSCP grades calendar
--   'regular' = all non-HSCP grades calendar
-- school_year is derived from work_date (Aug–May Pacific rule) by the app.
-- =============================================================================

CREATE TABLE IF NOT EXISTS working_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_date date NOT NULL,
  school_year text NOT NULL,
  calendar_type text NOT NULL CHECK (calendar_type IN ('hscp', 'regular')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT working_days_unique UNIQUE (work_date, school_year, calendar_type)
);

CREATE INDEX IF NOT EXISTS working_days_school_year_type_idx
  ON working_days (school_year, calendar_type);

CREATE INDEX IF NOT EXISTS working_days_work_date_idx
  ON working_days (work_date);

ALTER TABLE working_days ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read working days (needed for attendance date pickers)
DROP POLICY IF EXISTS "Authenticated users can read working days" ON working_days;
CREATE POLICY "Authenticated users can read working days"
  ON working_days
  FOR SELECT
  TO authenticated
  USING (true);

-- Writes go through the API with the service role key (bypasses RLS).
-- Optional: allow admins/HSCP officers to write directly from the client later.

COMMENT ON TABLE working_days IS 'Allowlist of class/working days per school year and calendar (hscp vs regular).';
COMMENT ON COLUMN working_days.calendar_type IS 'hscp = HSCP grades; regular = all other grades';
