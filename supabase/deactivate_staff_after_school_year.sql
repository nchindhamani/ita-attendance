-- =============================================================================
-- Deactivate staff one month after the last working day
-- Run manually in Supabase SQL Editor (no cron / no hosting cost).
-- =============================================================================
-- Rules:
--   - Last working day = MAX(work_date) from working_days (HSCP + Regular)
--   - Cutoff = last working day + 1 month
--   - Timezone for "today" = America/Los_Angeles
--   - Deactivates everyone EXCEPT role IN ('admin', 'hscp_officer')
--   - Idempotent: only updates rows that are still is_active = true
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Preview (run this first — does not change data)
-- -----------------------------------------------------------------------------
WITH last_wd AS (
  SELECT MAX(work_date) AS last_work_date
  FROM working_days
),
cutoff AS (
  SELECT
    last_work_date,
    (last_work_date + INTERVAL '1 month')::date AS deactivate_on,
    (CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles')::date AS today_pacific
  FROM last_wd
)
SELECT
  c.last_work_date,
  c.deactivate_on,
  c.today_pacific,
  (c.last_work_date IS NOT NULL AND c.today_pacific >= c.deactivate_on) AS ready_to_deactivate,
  (
    SELECT COUNT(*)::int
    FROM profiles p
    WHERE p.is_active = true
      AND p.role NOT IN ('admin', 'hscp_officer')
  ) AS active_users_who_would_be_deactivated
FROM cutoff c;

-- Who would be deactivated (preview list)
WITH last_wd AS (
  SELECT MAX(work_date) AS last_work_date
  FROM working_days
),
cutoff AS (
  SELECT
    last_work_date,
    (last_work_date + INTERVAL '1 month')::date AS deactivate_on,
    (CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles')::date AS today_pacific
  FROM last_wd
)
SELECT
  p.id,
  p.full_name,
  p.email,
  p.role,
  p.is_active
FROM profiles p
CROSS JOIN cutoff c
WHERE p.is_active = true
  AND p.role NOT IN ('admin', 'hscp_officer')
  AND c.last_work_date IS NOT NULL
  AND c.today_pacific >= c.deactivate_on
ORDER BY p.role, p.full_name;

-- -----------------------------------------------------------------------------
-- 2) Deactivate (run only after preview looks correct)
--    No-op if today is still before (last working day + 1 month).
-- -----------------------------------------------------------------------------
WITH last_wd AS (
  SELECT MAX(work_date) AS last_work_date
  FROM working_days
),
cutoff AS (
  SELECT
    last_work_date,
    (last_work_date + INTERVAL '1 month')::date AS deactivate_on,
    (CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles')::date AS today_pacific
  FROM last_wd
)
UPDATE profiles p
SET is_active = false
FROM cutoff c
WHERE p.is_active = true
  AND p.role NOT IN ('admin', 'hscp_officer')
  AND c.last_work_date IS NOT NULL
  AND c.today_pacific >= c.deactivate_on;

-- Optional: see how many rows were affected (Supabase SQL Editor shows update count).
