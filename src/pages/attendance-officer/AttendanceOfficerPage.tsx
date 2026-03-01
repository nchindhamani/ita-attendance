import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRequireRole } from '@/lib/auth-client'

export default function AttendanceOfficerPage() {
  useRequireRole('attendance_officer')

  return (
    <div className="space-y-12">
      <div className="space-y-3">
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight mb-3">
          Attendance Officer Dashboard
        </h2>
        <p className="text-lg text-[#64748b] font-normal leading-relaxed">
          Manage attendance for all sections and view student profiles.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Link to="/attendance-officer/attendance">
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Manage Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Edit attendance for all sections.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/attendance-officer/students">
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Student Profiles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View student profiles (read-only).
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}



