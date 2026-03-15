import { useRequireRole } from '@/lib/auth-client'
import { RecordTeacherAttendancePage } from '@/features/attendance/RecordTeacherAttendancePage'

export default function AttendanceOfficerRecordTeacherAttendancePage() {
  useRequireRole('attendance_officer')

  return (
    <RecordTeacherAttendancePage
      hscpOnly={false}
      basePath="/attendance-officer/record-teacher-attendance"
      gradeLabel="Grade"
      emptyMessage="No teachers found. Please ensure teachers are created and approved."
      subtitle="Record and edit attendance for all teachers."
      csvPrefix="teacher-attendance"
    />
  )
}
