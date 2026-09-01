import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

export type Address = Tables<"addresses">;

export async function getMyAddresses(): Promise<Address[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("addresses")
    .select("*")
    .eq("customer_id", user.id)
    .order("is_default", { ascending: false });

  return data ?? [];
}
