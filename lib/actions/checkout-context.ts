"use server";

import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/guards";
import { getCustomerForUser } from "@/lib/data/customers";
import { getDb, schema } from "@/lib/db";

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

  const user = await getCurrentUser();
  if (!user) return empty;

  const [customer, address] = await Promise.all([
    getCustomerForUser(user.id),
    getDb().query.addresses.findFirst({
      where: eq(schema.addresses.customer_id, user.id),
      orderBy: desc(schema.addresses.is_default),
    }),
  ]);

  return {
    authenticated: true,
    name: customer?.name ?? "",
    email: user.email,
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
