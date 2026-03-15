import { useRequireRole } from '@/lib/auth-client'
import { RecordTeacherAttendancePage } from '@/features/attendance/RecordTeacherAttendancePage'

export default function HSCPOfficerRecordTeacherAttendancePage() {
  useRequireRole('hscp_officer')

  return (
    <RecordTeacherAttendancePage
      hscpOnly
      basePath="/hscp-officer/record-teacher-attendance"
      gradeLabel="HSCP Grade"
      emptyMessage="No HSCP teachers found. Please ensure HSCP teachers are created and approved."
      subtitle="Record and edit attendance for HSCP teachers."
      csvPrefix="hscp-teacher-attendance"
    />
  )
}
