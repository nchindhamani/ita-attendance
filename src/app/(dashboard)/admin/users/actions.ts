"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function approveTeacher(profileId: string) {
  await requireRole("admin");
  const admin = createSupabaseAdminClient();
  await admin
    .from("profiles")
    .update({ is_approved: true })
    .eq("id", profileId);
  revalidatePath("/admin/users");
}

export async function toggleTeacherActive(profileId: string, isActive: boolean) {
  await requireRole("admin");
  const admin = createSupabaseAdminClient();
  await admin
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", profileId);
  revalidatePath("/admin/users");
}

