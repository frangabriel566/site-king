import { z } from "zod";

export const orderStatusSchema = z.object({
  order_id: z.uuid(),
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
