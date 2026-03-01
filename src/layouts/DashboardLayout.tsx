import { Outlet, Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { useRequireActiveProfile } from '@/lib/auth-client'
import { Sidebar } from '@/features/navigation/Sidebar'
import { BottomNav } from '@/features/navigation/BottomNav'

export default function DashboardLayout() {
  const { profile, loading } = useRequireActiveProfile()

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
          { href: "/admin", label: "Admin Overview" },
          { href: "/admin/users", label: "User Management" },
          { href: "/admin/attendance", label: "Attendance" },
          { href: "/admin/student-attendance", label: "Student Lookup" },
          { href: "/admin/archive", label: "Archive" },
          { href: "/profile", label: "Profile" },
        ]
      case "principal":
        return [
          { href: "/principal", label: "Overview" },
          { href: "/principal/student-attendance", label: "Student Attendance" },
          { href: "/principal/teacher-attendance", label: "Teacher Attendance" },
          { href: "/principal/users", label: "User Profiles" },
          { href: "/profile", label: "Profile" },
        ]
      case "attendance_officer":
        return [
          { href: "/attendance-officer", label: "Overview" },
          { href: "/attendance-officer/attendance", label: "Manage Attendance" },
          { href: "/attendance-officer/students", label: "Student Profiles" },
          { href: "/profile", label: "Profile" },
        ]
      case "hscp_officer":
        return [
          // { href: "/hscp-officer", label: "Overview" },
          { href: "/hscp-officer/teacher-attendance", label: "HSCP Teacher Attendance" },
          { href: "/hscp-officer/users", label: "HSCP Teacher Management" },
          { href: "/hscp-officer/hscp-student-attendance", label: "HSCP Student Attendance" },
          { href: "/hscp-officer/student-attendance", label: "HSCP Student Lookup" },
          { href: "/profile", label: "Profile" },
        ]
      case "teacher":
      default:
        return [
          { href: "/teacher", label: "My Class" },
          { href: "/attendance", label: "Attendance" },
          { href: "/history", label: "History" },
          { href: "/teacher/student-attendance", label: "Student Lookup" },
          { href: "/profile", label: "Profile" },
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
        className="md:hidden sticky top-0 z-50 w-full text-white px-6 py-5 shadow-lg"
        style={{
          background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
        }}
      >
        <div className="flex items-center justify-center gap-3">
          <div className="w-9 h-9 bg-[rgba(139,92,246,0.3)] rounded-[10px] flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div className="text-center">
            <Link to="/dashboard" className="text-lg font-heading font-bold text-white leading-tight hover:opacity-80 transition-opacity">
              ITA Attendance Hub
            </Link>
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

