import { redirect } from "next/navigation";
import { requireUser } from "./require-user";

export async function requireAdmin() {
  const { supabase, user } = await requireUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || profile?.role !== "admin") {
    redirect("/");
  }

  return { supabase, user, profile };
}
