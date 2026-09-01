import { createPublicClient } from "@/lib/supabase/public";
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
