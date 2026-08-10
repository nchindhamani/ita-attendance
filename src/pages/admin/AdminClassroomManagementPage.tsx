import { useRequireRole } from '@/lib/auth-client'
import { ClassroomManager } from '@/features/classroom/ClassroomManager'

export default function AdminClassroomManagementPage() {
  useRequireRole('admin')
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Classroom Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create and manage grade sections and room numbers for the current school year.
        </p>
      </div>
      <ClassroomManager />
    </div>
  )
}
