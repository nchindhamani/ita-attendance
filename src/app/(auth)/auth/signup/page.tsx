import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupForm } from "@/features/auth/SignupForm";

export default function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a teacher profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <SignupForm />
        <p className="text-sm text-muted-foreground">
          Already have an account? <Link href="/auth/login">Sign in</Link>
        </p>
      </CardContent>
    </Card>
  );
}

