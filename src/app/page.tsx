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
          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link href="/auth/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12">
        <section className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-primary">Modern, secure</p>
            <h2 className="text-3xl font-semibold">
              Attendance tracking made simple for teachers and admins.
            </h2>
            <p className="text-muted-foreground">
              Track attendance by class, approve new teachers, and securely
              archive each school year with a two-stage verification flow.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/auth/signup/teacher">Teacher signup</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/auth/signup/admin">Admin signup</Link>
              </Button>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>What you get</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>• Teacher approvals and active/inactive master switch.</p>
              <p>• Attendance status with 3:00 PM PT daily lock.</p>
              <p>• CSV upload for student rosters and export history.</p>
              <p>• School year archiving with verification and purge.</p>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
