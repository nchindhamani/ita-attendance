import { useRequireRole } from '@/lib/auth-client'
import { WorkingDaysManager } from '@/features/working-days/WorkingDaysManager'

export default function AdminWorkingDaysPage() {
  useRequireRole('admin')
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Working Days</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage HSCP and Regular grade calendars used for attendance.
        </p>
      </div>
      <WorkingDaysManager allowRegularCalendar defaultCalendarType="regular" />
    </div>
  )
}
