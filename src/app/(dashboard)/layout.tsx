import Link from "next/link";
import { Users } from "lucide-react";
import { requireActiveProfile } from "@/lib/auth";
import { SignOutButton } from "@/features/auth/SignOutButton";
import { Sidebar } from "@/features/navigation/Sidebar";
import { BottomNav } from "@/features/navigation/BottomNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireActiveProfile();

  const navLinks =
    profile.role === "admin"
      ? [
          { href: "/admin", label: "Admin Overview" },
          { href: "/admin/users", label: "User Management" },
          { href: "/admin/attendance", label: "Attendance" },
          { href: "/admin/student-attendance", label: "Student Lookup" },
          { href: "/admin/archive", label: "Archive" },
          { href: "/profile", label: "Profile" },
        ]
      : [
          { href: "/teacher", label: "My Classes" },
          { href: "/attendance", label: "Attendance" },
          { href: "/history", label: "History" },
          { href: "/teacher/student-attendance", label: "Student Lookup" },
          { href: "/profile", label: "Profile" },
        ];

  return (
    <div className="min-h-screen bg-[#fafafa] flex">
      {/* Desktop Sidebar */}
      <Sidebar navLinks={navLinks} profile={profile} />
      
      {/* Mobile Header */}
      <header 
        className="md:hidden sticky top-0 z-40 text-white px-6 py-5 shadow-lg"
        style={{
          background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
        }}
      >
        <div className="flex items-center justify-center gap-3">
          <div className="w-8 h-8 bg-[rgba(139,92,246,0.2)] rounded-lg flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div className="text-center">
            <div className="text-lg font-heading font-bold text-white leading-tight">
              ITA Attendance Hub
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Main Content Area */}
        <main className="flex-1 px-4 py-6 md:px-8 md:py-12 pb-20 md:pb-12 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav navLinks={navLinks} />
    </div>
  );
}

