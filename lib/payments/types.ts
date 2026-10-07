export type PaymentItem = {
  name: string;
  qty: number;
  unitPrice: number;
};

export type PaymentOrderInput = {
  orderId: string;
  orderNumber: number;
  /** Items at database prices, before the coupon. */
  subtotal: number;
  shipping: number;
  /** Coupon discount off the subtotal (0 without one). */
  discount: number;
  couponCode: string | null;
  /** subtotal + shipping − discount: what the shopper confirmed. */
  total: number;
  customerName: string;
  customerEmail: string;
  items: PaymentItem[];
};

export type PaymentInitResult =
  | { kind: "mercadopago"; url: string }
  | { kind: "whatsapp"; url: string };

export interface PaymentProvider {
  createPayment(input: PaymentOrderInput): Promise<PaymentInitResult>;
}
