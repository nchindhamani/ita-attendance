import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRequireRole } from '@/lib/auth-client'

export default function HSCPOfficerPage() {
  useRequireRole('hscp_officer')

  return (
    <div className="space-y-12">
      <div className="space-y-3">
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight mb-3">
          HSCP Officer Dashboard
        </h2>
        <p className="text-lg text-[#64748b] font-normal leading-relaxed">
          Manage HSCP teacher attendance and view HSCP student attendance.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <Link to="/hscp-officer/teachers">
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>HSCP Teachers Directory</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View and manage HSCP teachers.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/hscp-officer/teacher-attendance">
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>HSCP Teacher Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Insert, update, and view attendance for HSCP teachers.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/hscp-officer/student-attendance">
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>HSCP Student Lookup</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Search student attendance by student ID.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/hscp-officer/hscp-student-attendance">
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>HSCP Student Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View all HSCP student attendance by grade and date.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}

