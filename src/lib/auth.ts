import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Profile, Role } from "@/lib/types";

export async function getSession() {
  const supabase = createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function getProfile() {
  const supabase = createSupabaseServerClient();
  const session = await getSession();
  if (!session?.user) {
    return null;
  }

  const { data } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,is_active,is_approved")
    .eq("id", session.user.id)
    .maybeSingle<Profile>();

  return data ?? null;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/auth/login");
  }
}

export async function requireActiveProfile() {
  const profile = await getProfile();
  if (!profile) {
    redirect("/auth/login");
  }
  if (!profile.is_active) {
    redirect("/account-disabled");
  }
  if (profile.role === "teacher" && !profile.is_approved) {
    redirect("/auth/pending-approval");
  }
  return profile;
}

export async function requireRole(role: Role) {
  const profile = await requireActiveProfile();
  if (profile.role !== role) {
    redirect("/dashboard");
  }
  return profile;
}

