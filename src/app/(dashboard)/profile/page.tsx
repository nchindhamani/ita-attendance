import { requireActiveProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileView } from "@/features/profile/ProfileView";

export default async function ProfilePage() {
  const profile = await requireActiveProfile();
  const admin = createSupabaseAdminClient();

  const { data: profileData } = await admin
    .from("profiles")
    .select(
      "id,full_name,email,mobile,role,grade,section,room_number,created_at"
    )
    .eq("id", profile.id)
    .single();

  if (!profileData) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-destructive">
            Unable to load your profile. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <ProfileView profileData={profileData} />;
}

