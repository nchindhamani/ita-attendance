import { useRequireRole } from '@/lib/auth-client'
import { StudentLookupPage } from '@/features/admin/StudentLookupPage'

export default function AdminStudentAttendancePage() {
  useRequireRole('admin')

  return (
    <StudentLookupPage
      basePath="/admin/student-attendance"
      title="Student Attendance Lookup"
      canDelete
    />
  )
}
