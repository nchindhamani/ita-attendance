import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PendingPage() {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Account pending</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Your account is currently disabled. Please contact the ITA admin
              team if you believe this is an error.
            </p>
            <Button asChild variant="outline">
              <Link href="/auth/login">Return to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

