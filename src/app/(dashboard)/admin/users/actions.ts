"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Role } from "@/lib/types";

async function assertAdmin() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,role,is_active,is_approved")
    .eq("id", user.id)
    .maybeSingle<{
      id: string;
      role: Role;
      is_active: boolean;
      is_approved: boolean;
    }>();

  if (!profile || profile.role !== "admin" || !profile.is_active || !profile.is_approved) {
    return { error: "Unauthorized" };
  }

  return { profile };
}

export async function approveUserAsRole(profileId: string, role: Role) {
  const { profile, error } = await assertAdmin();
  if (error) return { error };
  if (profile?.id === profileId) {
    return { error: "Unauthorized" };
  }

  const admin = createSupabaseAdminClient();
  await admin
    .from("profiles")
    .update({
      is_approved: true,
      is_active: true,
      role: role === "admin" ? "admin" : "teacher",
    })
    .eq("id", profileId);
  revalidatePath("/admin/users");
  return { success: "User approved." };
}

export async function toggleUserActiveStatus(
  profileId: string,
  isActive: boolean
) {
  const { error } = await assertAdmin();
  if (error) return { error };

  const admin = createSupabaseAdminClient();
  await admin
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", profileId);
  revalidatePath("/admin/users");
  return { success: "Status updated." };
}

export async function updateUserRole(profileId: string, role: Role) {
  const { error } = await assertAdmin();
  if (error) return { error };

  const admin = createSupabaseAdminClient();
  await admin.from("profiles").update({ role }).eq("id", profileId);
  revalidatePath("/admin/users");
  return { success: "Role updated." };
}

