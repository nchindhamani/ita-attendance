import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Search, 
  Archive, 
  User,
  MoreHorizontal,
  ClipboardCheck,
  UserCog,
  CalendarCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface NavLink {
  href: string;
  label: string;
}

interface BottomNavProps {
  navLinks: NavLink[];
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "Admin Overview": LayoutDashboard,
  "My Class": LayoutDashboard,
  "User Management": Users,
  "Attendance": Calendar,
  "History": Calendar,
  "Student Lookup": Search,
  "Archive": Archive,
  "Profile": User,
  // HSCP Officer
  "HSCP Teacher Attendance": ClipboardCheck,
  "HSCP Teacher Management": UserCog,
  "HSCP Student Attendance": CalendarCheck,
  "HSCP Student Lookup": Search,
};

// Map full labels to shorter mobile labels
const labelMap: Record<string, string> = {
  "Admin Overview": "Admin",
  "My Class": "Classes",
  "User Management": "Users",
  "Attendance": "Attendance",
  "History": "History",
  "Student Lookup": "Lookup",
  "Archive": "Archive",
  "Profile": "Profile",
  // HSCP Officer
  "HSCP Teacher Attendance": "Tchr Att.",
  "HSCP Teacher Management": "Teachers",
  "HSCP Student Attendance": "Stu Att.",
  "HSCP Student Lookup": "Stu Lookup",
};

export function BottomNav({ navLinks }: BottomNavProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const mainLinks = navLinks.slice(0, 4);
  const moreLinks = navLinks.slice(4);

  const handleMoreLinkClick = (href: string) => {
    navigate(href);
    setMoreMenuOpen(false);
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#e5e5e5] px-2 py-2 md:hidden" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
        <div className="flex justify-around items-center">
          {mainLinks.map((link) => {
            const isActive = 
              pathname === link.href || 
              (pathname.startsWith(`${link.href}/`) && link.href !== "/admin" && link.href !== "/teacher");
            
            const Icon = iconMap[link.label] || LayoutDashboard;
            const shortLabel = labelMap[link.label] || link.label;

            return (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "relative flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all duration-300",
                  isActive
                    ? "text-[#8b5cf6]"
                    : "text-[#94a3b8]"
                )}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-[#8b5cf6] rounded-full" />
                )}
                <Icon className="w-6 h-6" />
                <span className="text-[0.75rem] font-semibold whitespace-nowrap">{shortLabel}</span>
              </Link>
            );
          })}
          
          {/* More Button - Only show if there are more links */}
          {moreLinks.length > 0 && (
            <button
              onClick={() => setMoreMenuOpen(true)}
              className={cn(
                "relative flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all duration-300",
                moreLinks.some(link => 
                  pathname === link.href || 
                  (pathname.startsWith(`${link.href}/`) && link.href !== "/admin" && link.href !== "/teacher")
                )
                  ? "text-[#8b5cf6]"
                  : "text-[#94a3b8]"
              )}
            >
              {moreLinks.some(link => 
                pathname === link.href || 
                (pathname.startsWith(`${link.href}/`) && link.href !== "/admin" && link.href !== "/teacher")
              ) && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-[#8b5cf6] rounded-full" />
              )}
              <MoreHorizontal className="w-6 h-6" />
              <span className="text-[0.75rem] font-semibold whitespace-nowrap">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* More Menu Dialog */}
      <Dialog open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
        <DialogContent className="max-w-[280px] p-0 sm:max-w-[320px]">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-xl font-heading">More Options</DialogTitle>
          </DialogHeader>
          <div className="px-4 py-4 max-h-[60vh] overflow-y-auto">
            <nav className="space-y-1">
              {moreLinks.map((link) => {
                const isActive = 
                  pathname === link.href || 
                  (pathname.startsWith(`${link.href}/`) && link.href !== "/admin" && link.href !== "/teacher");
                
                const Icon = iconMap[link.label] || LayoutDashboard;
                
                return (
                  <button
                    key={link.href}
                    onClick={() => handleMoreLinkClick(link.href)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left",
                      isActive
                        ? "bg-purple-100 text-purple-700 font-semibold"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{link.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

