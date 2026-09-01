import "server-only";
import { createClient } from "@/lib/supabase/server";

export class AdminAuthError extends Error {}

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new AdminAuthError("UNAUTHORIZED");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new AdminAuthError("FORBIDDEN");

  return { supabase, user };
}
