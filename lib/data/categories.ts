import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import { safeQuery } from "./safe";

export type Category = Tables<"categories">;

export async function getActiveCategories(): Promise<Category[]> {
  return safeQuery(async () => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("active", true)
      .order("position", { ascending: true });

    return data ?? [];
  }, []);
}

/** Admin listing — all rows (including inactive), session-scoped RLS. */
export async function getAllCategoriesAdmin(): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .order("position", { ascending: true });

  return data ?? [];
}
