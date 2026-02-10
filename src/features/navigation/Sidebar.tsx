import { Link, useLocation } from "react-router-dom";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/features/auth/SignOutButton";

interface NavLink {
  href: string;
  label: string;
}

interface SidebarProps {
  navLinks: NavLink[];
  profile: {
    full_name: string | null;
    email: string | null;
  };
}

export function Sidebar({ navLinks, profile }: SidebarProps) {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <aside 
      className="hidden md:flex w-[280px] flex-shrink-0 flex-col text-white relative h-screen"
      style={{
        background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
      }}
    >
      {/* Subtle gradient overlay for depth */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(circle at 20% 20%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 50%)
          `,
        }}
      />

      <div className="relative z-10 flex flex-col h-full">
        {/* Sidebar Header */}
        <div className="px-8 pb-8 pt-8 border-b border-white/10 flex-shrink-0">
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-[rgba(139,92,246,0.2)] rounded-[10px] flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="font-heading text-2xl font-bold text-white leading-tight">
              <div>ITA</div>
              <div className="text-lg">Attendance Hub</div>
            </div>
          </Link>
        </div>

        {/* Navigation & User Info - Scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <nav className="px-4 pt-8 space-y-1">
            {navLinks.map((link) => {
              const isActive = 
                pathname === link.href || 
                (pathname.startsWith(`${link.href}/`) && link.href !== "/admin" && link.href !== "/teacher");
              
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    "relative flex items-center gap-4 px-5 py-3 rounded-xl transition-all duration-300 ease-smooth",
                    isActive
                      ? "bg-[rgba(139,92,246,0.2)] text-white font-semibold backdrop-blur-sm"
                      : "text-white/70 hover:text-white hover:bg-white/10 hover:translate-x-1"
                  )}
                >
                  {isActive && (
                    <div 
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-[60%] rounded-r"
                      style={{ background: "#8b5cf6" }}
                    />
                  )}
                  <span className="text-[0.95rem] font-medium">{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Info & Sign Out - Scrolls with navigation */}
          <div className="px-4 pb-8 pt-8 border-t border-white/10 mt-8">
            <div className="px-4 py-3 mb-3 rounded-xl bg-white/5">
              <div className="text-xs text-white/50 mb-1 uppercase tracking-wider">Signed in as</div>
              <div className="text-sm font-medium text-white truncate">
                {profile.full_name ?? profile.email}
              </div>
            </div>
            <div className="px-4">
              <SignOutButton variant="sidebar" />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

