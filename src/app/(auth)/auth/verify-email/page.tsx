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
          We sent a confirmation email to you. Please verify your email address
          before signing in.
        </p>
        <Button asChild variant="outline">
          <Link href="/auth/login">Return to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

