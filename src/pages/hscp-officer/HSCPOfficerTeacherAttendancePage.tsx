import ViewAttendancePage from '@/features/attendance/ViewAttendancePage'

export default function HSCPOfficerTeacherAttendancePage() {
  return (
    <ViewAttendancePage
      hscpOnly
      basePath="/hscp-officer/teacher-attendance"
      title="HSCP Attendance"
      subtitle="View teacher and student attendance for HSCP grades."
      gradeLabel="HSCP Grade"
      csvPrefix="hscp-attendance"
      emptyMessage="No HSCP teachers found. Please ensure HSCP teachers are created and approved."
    />
  )
}
