"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ProfileView } from "@/features/profile/ProfileView";
import { Card, CardContent } from "@/components/ui/card";

export default function ProfilePage() {
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    async function fetchProfile() {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }

        // Get profile data using admin client approach (service role for now)
        // In production, you might want to create a GET /api/profile endpoint
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id,full_name,email,mobile,role,grade,section,room_number,created_at")
          .eq("id", user.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        if (!profile) {
          setError("Profile not found");
          setLoading(false);
          return;
        }

        setProfileData(profile);
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

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

