import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRequireRole } from '@/lib/auth-client'

export default function PrincipalPage() {
  useRequireRole('principal')

  return (
    <div className="space-y-12">
      <div className="space-y-3">
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight mb-3">
          Principal Dashboard
        </h2>
        <p className="text-lg text-[#64748b] font-normal leading-relaxed">
          View student attendance, teacher attendance, and user profiles (read-only).
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <Link to="/principal/student-attendance">
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Student Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View student attendance records across all sections (read-only).
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/principal/teacher-attendance">
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Teacher Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View teacher attendance records (read-only).
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/principal/users">
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>User Profiles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View all user profiles (read-only).
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}



