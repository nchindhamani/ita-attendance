import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify your email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          Please check your inbox for an email from Supabase Auth and verify
          your address before signing in.
        </p>
        <p>
          The verification email should have a subject like: “ITA Attendance
          Portal – Email Verification for Teacher &lt;Your Name&gt;”.
        </p>
        <Button asChild variant="outline">
          <Link href="/auth/login">Return to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

