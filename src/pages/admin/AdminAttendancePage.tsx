import ViewAttendancePage from '@/features/attendance/ViewAttendancePage'

export default function AdminAttendancePage() {
  return (
    <ViewAttendancePage
      hscpOnly={false}
      basePath="/admin/attendance"
      title="Attendance"
      subtitle="View teacher and student attendance for all grades."
      gradeLabel="Grade"
      csvPrefix="attendance"
      emptyMessage="No teachers or grades found."
      canDeleteAttendance
    />
  )
}
