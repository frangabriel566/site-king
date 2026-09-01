export type PaymentItem = {
  name: string;
  qty: number;
  unitPrice: number;
};

export type PaymentOrderInput = {
  orderId: string;
  orderNumber: number;
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
