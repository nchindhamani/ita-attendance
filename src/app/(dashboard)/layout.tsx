import Link from "next/link";
import { requireActiveProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/(auth)/auth/actions";

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
          { href: "/admin/archive", label: "Archive" },
        ]
      : [
          { href: "/teacher", label: "My Classes" },
          { href: "/attendance", label: "Attendance" },
          { href: "/history", label: "History" },
        ];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-lg font-semibold">
              ITA Attendance Portal
            </Link>
            <nav className="hidden gap-4 text-sm text-muted-foreground md:flex">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {profile.full_name ?? profile.email}
            </span>
            <form action={signOut}>
              <Button size="sm" variant="outline" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

