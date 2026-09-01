import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

export type Coupon = Tables<"coupons">;

export async function getAllCouponsAdmin(): Promise<Coupon[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coupons")
    .select("*")
    .order("code", { ascending: true });

  return data ?? [];
}

export async function getCouponByIdAdmin(id: string): Promise<Coupon | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("coupons").select("*").eq("id", id).maybeSingle();
  return data;
}
