import { redirect } from "next/navigation";
import { requireActiveProfile } from "@/lib/auth";

export default async function DashboardPage() {
  const profile = await requireActiveProfile();
  if (profile.role === "admin") {
    redirect("/admin");
  }
  redirect("/teacher");
}

