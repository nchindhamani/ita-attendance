import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "@/features/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResetPasswordForm />
        <p className="text-sm text-muted-foreground">
          Remembered your password? <Link href="/auth/login">Sign in</Link>
        </p>
      </CardContent>
    </Card>
  );
}


