import { Outlet, Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { useRequireActiveProfile } from '@/lib/auth-client'
import { Sidebar } from '@/features/navigation/Sidebar'
import { BottomNav } from '@/features/navigation/BottomNav'
import { SignOutButton } from '@/features/auth/SignOutButton'
import { useInactivityLogout } from '@/hooks/useInactivityLogout'

export default function DashboardLayout() {
  const { profile, loading } = useRequireActiveProfile()

  // Auto-logout after 15 minutes of inactivity
  useInactivityLogout()

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const getNavLinks = () => {
    switch (profile.role) {
      case "admin":
        return [
          { href: "/admin/users", label: "Staff Management" },
          { href: "/admin/student-attendance", label: "Student Management" },
          { href: "/admin/attendance", label: "Attendance" },
          { href: "/admin/staff-attendance", label: "Record Volunteer/Staff Attendance" },
          { href: "/admin/working-days", label: "Working Days" },
          { href: "/admin/classrooms", label: "Classroom Management" },
          { href: "/admin/archive", label: "Archive" },
          { href: "/profile", label: "Profile" },
        ]
      case "principal":
        return [
          { href: "/principal", label: "Overview" },
          { href: "/principal/staff-attendance", label: "Record Volunteer/Staff Attendance" },
          { href: "/principal/staff-management", label: "Staff Management" },
          { href: "/principal/student-attendance", label: "Student Attendance" },
          { href: "/principal/teacher-attendance", label: "Teacher Attendance" },
          { href: "/principal/users", label: "User Profiles" },
          { href: "/profile", label: "Profile" },
        ]
      case "attendance_officer":
        return [
          { href: "/attendance-officer/record-teacher-attendance", label: "Record Teacher Attendance" },
          { href: "/attendance-officer/record-student-attendance", label: "Record Student Attendance" },
          { href: "/attendance-officer/teacher-attendance", label: "View Attendance" },
          { href: "/attendance-officer/users", label: "Teacher Management" },
          { href: "/attendance-officer/student-attendance", label: "Student Lookup" },
          { href: "/profile", label: "Profile" },
        ]
      case "hscp_officer":
        return [
          { href: "/hscp-officer/record-teacher-attendance", label: "Record Teacher Attendance" },
          { href: "/hscp-officer/record-student-attendance", label: "Record Student Attendance" },
          { href: "/hscp-officer/teacher-attendance", label: "View HSCP Attendance" },
          { href: "/hscp-officer/users", label: "HSCP Teacher Management" },
          { href: "/hscp-officer/student-attendance", label: "HSCP Student Management" },
          { href: "/hscp-officer/working-days", label: "Working Days" },
          { href: "/hscp-officer/classrooms", label: "Classroom Management" },
          { href: "/profile", label: "Profile" },
        ]
      case "teacher":
      default:
        return [
          { href: "/attendance", label: "Mark Attendance" },
          { href: "/history", label: "Date Lookup" },
          { href: "/teacher/student-attendance", label: "Student Lookup" },
          { href: "/teacher", label: "My Students" },
          { href: "/profile", label: "My Profile" },
          { href: "/teacher/help", label: "Help" },
        ]
    }
  }

  const navLinks = getNavLinks()

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col md:flex-row">
      {/* Desktop Sidebar - Hidden on mobile */}
      <Sidebar navLinks={navLinks} profile={profile} />
      
      {/* Mobile Header - Only visible on mobile */}
      <header 
        className="md:hidden sticky top-0 z-50 w-full text-white px-4 py-4 shadow-lg"
        style={{
          background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center justify-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 bg-[rgba(139,92,246,0.3)] rounded-[10px] flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
            <Link to="/dashboard" className="text-lg font-heading font-bold text-white leading-tight hover:opacity-80 transition-opacity truncate">
              ITA Attendance Hub
            </Link>
          </div>
          <div className="flex-shrink-0">
            <SignOutButton
              variant="sidebar"
              className="!w-auto !px-3 !py-2 !text-sm whitespace-nowrap"
            />
          </div>
        </div>
      </header>

      {/* Main Content - Full width on mobile */}
      <div className="flex-1 flex flex-col min-w-0 w-full md:w-auto">
        {/* Main Content Area */}
        <main className="flex-1 w-full px-4 py-6 md:px-8 md:py-12 pb-24 md:pb-12 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation - Only visible on mobile */}
      <BottomNav navLinks={navLinks} />
    </div>
  )
}

