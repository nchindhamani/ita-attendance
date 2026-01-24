import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PendingApprovalPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval pending</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>Your teacher profile is awaiting admin approval.</p>
        <p>
          You will receive access as soon as an administrator approves your
          profile.
        </p>
      </CardContent>
    </Card>
  );
}

