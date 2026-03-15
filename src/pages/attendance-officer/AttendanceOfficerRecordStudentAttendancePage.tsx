import { useRequireRole } from '@/lib/auth-client'
import { RecordStudentAttendancePage } from '@/features/attendance/RecordStudentAttendancePage'

export default function AttendanceOfficerRecordStudentAttendancePage() {
  useRequireRole('attendance_officer')

  return (
    <RecordStudentAttendancePage
      hscpOnly={false}
      basePath="/attendance-officer/record-student-attendance"
    />
  )
}
