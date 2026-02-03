import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-8">
          <div>
            <p className="text-sm font-semibold text-primary">ITA</p>
            <h1 className="text-xl font-heading font-semibold">Attendance Hub</h1>
          </div>
          <div className="flex items-center gap-6" />
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-8 py-24">
        <section className="flex flex-col items-center text-center">
          <div className="space-y-8">
            <p className="text-sm font-semibold text-primary">Modern & Secure</p>
            <h2 className="text-5xl font-heading font-semibold leading-tight">
              Attendance tracking built for ITA teachers and admins.
            </h2>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              Secure, admin-approved access for teachers and staff.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              <Button asChild size="lg">
                <Link href="/auth/signup">Sign up</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/auth/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
