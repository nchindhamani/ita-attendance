"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Search, 
  Archive, 
  User 
} from "lucide-react";

interface NavLink {
  href: string;
  label: string;
}

interface BottomNavProps {
  navLinks: NavLink[];
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "Admin Overview": LayoutDashboard,
  "My Classes": LayoutDashboard,
  "User Management": Users,
  "Attendance": Calendar,
  "History": Calendar,
  "Student Lookup": Search,
  "Archive": Archive,
  "Profile": User,
};

export function BottomNav({ navLinks }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#e5e5e5] px-2 py-2 md:hidden" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
      <div className="flex justify-around items-center">
        {navLinks.slice(0, 4).map((link) => {
          const isActive = 
            pathname === link.href || 
            (pathname.startsWith(`${link.href}/`) && link.href !== "/admin" && link.href !== "/teacher");
          
          const Icon = iconMap[link.label] || LayoutDashboard;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "relative flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-300",
                isActive
                  ? "text-[#8b5cf6]"
                  : "text-[#94a3b8]"
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-[#8b5cf6] rounded-full" />
              )}
              <Icon className="w-5 h-5" />
              <span className="text-[0.6875rem] font-medium">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

