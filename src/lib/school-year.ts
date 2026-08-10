/**
 * ITA school year runs August–May (Pacific / America/Los_Angeles).
 *
 * Examples:
 * - Aug 2026 – May 2027  →  "2026-2027"
 * - Jun/Jul 2027 (summer) →  "2026-2027"  (until August starts the next year)
 * - Aug 2027             →  "2027-2028"
 *
 * This is the source of truth for the "current" school year.
 * Do not fall back to a hardcoded year like 2025-2026.
 */
export function getCurrentSchoolYear(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date)

  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    // Last-resort calendar fallback without a hardcoded academic year string
    const local = date
    const y = local.getFullYear()
    const m = local.getMonth() + 1
    return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`
  }

  if (month >= 8) {
    return `${year}-${year + 1}`
  }
  return `${year - 1}-${year}`
}

/**
 * Parse MM/DD/YYYY (or M/D/YYYY) into a Date at noon UTC (date-only safe),
 * or return null if invalid.
 */
export function parseMdYDate(value: string): Date | null {
  const trimmed = value.trim()
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  const year = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

/** School year for a calendar date (Aug–May Pacific rule using the date's Y/M). */
export function getSchoolYearForDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  if (month >= 8) return `${year}-${year + 1}`
  return `${year - 1}-${year}`
}

/** Format Date as YYYY-MM-DD (UTC date parts). */
export function toIsoDateUTC(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export type WorkingDaysCalendarType = 'hscp' | 'regular'
