import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6">
          <Link href="/" className="text-lg font-semibold">
            ITA Attendance Portal
          </Link>
          <Link href="/auth/login" className="text-sm text-muted-foreground">
            Return to login
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-10">{children}</main>
    </div>
  );
}

