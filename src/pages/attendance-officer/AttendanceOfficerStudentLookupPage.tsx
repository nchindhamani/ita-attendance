import { useRequireRole } from '@/lib/auth-client'
import { StudentLookupPage } from '@/features/admin/StudentLookupPage'

export default function AttendanceOfficerStudentLookupPage() {
  useRequireRole('attendance_officer')

  return (
    <StudentLookupPage
      basePath="/attendance-officer/student-attendance"
      title="Student Lookup"
      canDelete={false}
    />
  )
}
