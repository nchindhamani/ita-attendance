-- =============================================================================
-- Production setup: 2026-2027 school year + HSCP sections + working_days table
-- Run in Supabase SQL Editor when ready for production.
-- =============================================================================

UPDATE system_settings
SET current_school_year = '2026-2027'
WHERE id = 1;


INSERT INTO sections (grade, section, room_number, school_year)
SELECT v.grade, v.section, v.room_number, '2026-2027'
FROM (
  VALUES
    ('HSCP-1', 'Conversation', NULL),
    ('HSCP-1', 'Reading', NULL),
    ('HSCP-1', 'Writing', NULL),
    ('HSCP-2', 'Conversation', NULL),
    ('HSCP-2', 'Reading', NULL),
    ('HSCP-2', 'Writing', NULL),
    ('HSCP-3', 'Conversation', NULL),
    ('HSCP-3', 'Reading', NULL),
    ('HSCP-3', 'Writing', NULL)
) AS v(grade, section, room_number)
WHERE NOT EXISTS (
  SELECT 1
  FROM sections s
  WHERE s.grade = v.grade
    AND s.section = v.section
    AND s.school_year = '2026-2027'
);


-- =============================================================================
-- Working Days table
-- Run this in Supabase SQL Editor.
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
DROP POLICY IF EXISTS "Authenticated users can read working days" ON working_days;
CREATE POLICY "Authenticated users can read working days"
  ON working_days
  FOR SELECT
  TO authenticated
  USING (true);
