import { createClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProfileDebugPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    {
      auth: { persistSession: false },
    }
  );
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email,role,is_active,is_approved")
    .limit(1)
    .maybeSingle();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profiles debug</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {error ? (
          <div>
            <p className="font-medium text-destructive">Error:</p>
            <p>{error.message}</p>
          </div>
        ) : data ? (
          <pre className="rounded-md bg-muted p-3 text-xs text-foreground">
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : (
          <p>No profiles found.</p>
        )}
      </CardContent>
    </Card>
  );
}

