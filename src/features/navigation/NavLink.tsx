import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  label: string;
}

export function NavLink({ href, label }: NavLinkProps) {
  const location = useLocation();
  const pathname = location.pathname;
  
  // More precise active state matching
  // For routes like /admin, only match exactly (not /admin/student-attendance)
  // For routes like /admin/users, match exactly or children like /admin/users/123
  const isExactMatch = pathname === href;
  const isChildRoute = pathname.startsWith(`${href}/`);
  
  // Special case: if href is a parent route (like /admin), only match exactly
  // Otherwise, allow child routes
  const isActive = isExactMatch || (isChildRoute && href !== "/admin" && href !== "/teacher");

  return (
    <Link
      to={href}
      className={cn(
        "relative px-6 py-3 rounded-lg transition-all duration-300 ease-smooth border-b-2 border-transparent",
        isActive
          ? "text-[#6366f1] bg-[rgba(99,102,241,0.08)] font-semibold border-b-[#6366f1]"
          : "text-[#64748b] hover:text-[#1e293b] hover:bg-[rgba(99,102,241,0.05)]"
      )}
    >
      {label}
    </Link>
  );
}

