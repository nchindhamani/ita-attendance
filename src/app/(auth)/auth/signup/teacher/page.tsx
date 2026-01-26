import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupForm } from "@/features/auth/SignupForm";

export default function TeacherSignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Teacher signup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <SignupForm role="teacher" requireTeacherFields />
        <p className="text-sm text-muted-foreground">
          Already have an account? <Link href="/auth/login">Sign in</Link>
        </p>
      </CardContent>
    </Card>
  );
}

