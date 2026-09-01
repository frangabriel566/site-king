import { z } from "zod";

export const orderStatusSchema = z.object({
  // z.guid(), not z.uuid() — see lib/validations/product.ts for why.
  order_id: z.guid(),
  status: z.enum([
    "pending",
    "paid",
    "processing",
    "shipped",
    "delivered",
    "canceled",
  ]),
  tracking_code: z.string().trim().max(80).optional().or(z.literal("")),
});

export type OrderStatusInput = z.infer<typeof orderStatusSchema>;
