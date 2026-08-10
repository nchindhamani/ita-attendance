import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { WorkingDaysCalendarType } from '@/lib/school-year'

const supabase = createSupabaseBrowserClient()

export type { WorkingDaysCalendarType }

export function calendarTypeForGrade(grade: string | null | undefined): WorkingDaysCalendarType {
  const g = (grade || '').trim().toUpperCase()
  return g.startsWith('HSCP') ? 'hscp' : 'regular'
}

/** Normalize DB/date values to YYYY-MM-DD. */
export function toIsoDateOnly(value: string | null | undefined): string | null {
  if (!value) return null
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value).trim())
  return match ? match[1] : null
}

/** Fetch working days (YYYY-MM-DD) for a school year + calendar. */
export async function fetchWorkingDays(
  schoolYear: string,
  calendarType: WorkingDaysCalendarType,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('working_days')
    .select('work_date')
    .eq('school_year', schoolYear)
    .eq('calendar_type', calendarType)
    .order('work_date', { ascending: true })

  if (error) {
    console.error('Error fetching working days:', error)
    return []
  }
  return (data || [])
    .map((row) => toIsoDateOnly(row.work_date))
    .filter((d): d is string => Boolean(d))
}

/** Working days on or before today (can be saved). */
export function pastOrTodayWorkingDays(dates: string[], todayIso: string): string[] {
  return dates.filter((d) => d <= todayIso).sort()
}

/** Format YYYY-MM-DD as MM/DD/YYYY for user-facing messages. */
export function formatIsoAsMdY(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return iso
  return `${match[2]}/${match[3]}/${match[1]}`
}

/**
 * Prefer today if it is a working day; else most recent ≤ today;
 * else the next upcoming working day (so the picker lands on a valid class day).
 */
export function pickDefaultWorkingDate(dates: string[], todayIso: string): string {
  if (!dates.length) return ''
  const sorted = [...dates].sort()
  if (sorted.includes(todayIso)) return todayIso
  const pastOrToday = pastOrTodayWorkingDays(sorted, todayIso)
  if (pastOrToday.length) return pastOrToday[pastOrToday.length - 1]
  const upcoming = sorted.find((d) => d > todayIso)
  return upcoming || ''
}
