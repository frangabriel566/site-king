"use server";

import { createClient } from "@/lib/supabase/server";

export type CheckoutContext = {
  authenticated: boolean;
  name: string;
  email: string;
  phone: string;
  defaultAddress: {
    cep: string;
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
  } | null;
};

export async function getCheckoutContextAction(): Promise<CheckoutContext> {
  const empty: CheckoutContext = {
    authenticated: false,
    name: "",
    email: "",
    phone: "",
    defaultAddress: null,
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return empty;

  const [{ data: customer }, { data: address }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("addresses")
      .select("*")
      .eq("customer_id", user.id)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    authenticated: true,
    name: customer?.name ?? "",
    email: user.email ?? "",
    phone: customer?.phone ?? "",
    defaultAddress: address
      ? {
          cep: address.cep,
          street: address.street,
          number: address.number,
          complement: address.complement ?? "",
          district: address.district,
          city: address.city,
          state: address.state,
        }
      : null,
  };
}
