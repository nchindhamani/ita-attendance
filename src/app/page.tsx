import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
          <div>
            <p className="text-sm font-semibold text-primary">ITA</p>
            <h1 className="text-lg font-semibold">Attendance Portal</h1>
          </div>
          <div className="flex items-center gap-3" />
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12">
        <section className="flex flex-col items-center text-center">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-primary">Modern & Secure</p>
            <h2 className="text-3xl font-semibold">
              Attendance tracking built for ITA teachers and admins.
            </h2>
            <p className="text-sm text-muted-foreground">
              Secure, admin-approved access for teachers and staff.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href="/auth/signup">Sign up</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/auth/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
