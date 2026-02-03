import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-8">
          <Link href="/" className="text-xl font-heading font-semibold text-foreground transition-colors hover:text-primary">
            ITA Attendance Hub
          </Link>
          <Link href="/auth/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Return to login
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-md px-8 py-20">{children}</main>
    </div>
  );
}

