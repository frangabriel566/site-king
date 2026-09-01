import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

export type Customer = Tables<"customers"> & { email: string | null };

export async function getAllCustomersAdmin(): Promise<Customer[]> {
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (!customers || customers.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email")
    .in("id", customers.map((c) => c.id));

  const emailMap = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  return customers.map((c) => ({ ...c, email: emailMap.get(c.id) ?? null }));
}

export async function getCustomerByIdAdmin(id: string): Promise<Customer | null> {
  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!customer) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", id)
    .maybeSingle();

  return { ...customer, email: profile?.email ?? null };
}
