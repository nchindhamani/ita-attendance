import { useRequireRole } from '@/lib/auth-client'
import ViewAttendancePage from '@/features/attendance/ViewAttendancePage'

export default function AttendanceOfficerViewAttendancePage() {
  useRequireRole('attendance_officer')

  return (
    <ViewAttendancePage
      hscpOnly={false}
      basePath="/attendance-officer/teacher-attendance"
      title="Attendance"
      subtitle="View teacher and student attendance for all grades."
      gradeLabel="Grade"
      csvPrefix="attendance"
      emptyMessage="No teachers or grades found."
      canDeleteAttendance={false}
    />
  )
}
