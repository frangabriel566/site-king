import "server-only";
import { getMelhorEnvioCredentials } from "@/lib/integrations";

/**
 * Melhor Envio REST client.
 *
 * The token, the host (sandbox or production — same paths, different
 * accounts) and the contact e-mail come from Admin → Integrações, with
 * the old MELHORENVIO_TOKEN / MELHORENVIO_URL / MELHORENVIO_EMAIL variables
 * as fallback (lib/integrations). The e-mail goes in the User-Agent:
 * Melhor Envio documents it as required and answers 403 without it — it
 * is how they reach the integrator about a misbehaving client.
 *
 * Only while the integration is switched on: off in the panel, every call
 * here fails as "not configured".
 */

export class MelhorEnvioError extends Error {
  readonly status?: number;
  readonly detail?: unknown;

  constructor(message: string, status?: number, detail?: unknown) {
    super(message);
    this.name = "MelhorEnvioError";
    this.status = status;
    this.detail = detail;
  }
}

export class MelhorEnvioNotConfiguredError extends MelhorEnvioError {}

async function config() {
  const credentials = await getMelhorEnvioCredentials({ requireActive: true });
  if (!credentials) {
    throw new MelhorEnvioNotConfiguredError("Melhor Envio não está ativo (Admin → Integrações).");
  }
  return credentials;
}

async function request<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<T> {
  const { baseUrl, token, email } = await config();

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: init.method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": `King Store (${email})`,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new MelhorEnvioError("Não foi possível falar com o Melhor Envio.");
  }

  const raw = await response.text();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    // A gateway timeout or a maintenance page — HTML, not JSON. Fall
    // through to the status check with parsed still null rather than
    // letting a SyntaxError escape as something unrelated.
  }

  if (!response.ok) {
    const detail = parsed as { message?: string; error?: string } | null;
    throw new MelhorEnvioError(
      detail?.message ?? detail?.error ?? `Melhor Envio respondeu ${response.status}.`,
      response.status,
      parsed,
    );
  }

  return parsed as T;
}

// ------------------------------------------------------------------
// Quoting
// ------------------------------------------------------------------

/** One parcel line as Melhor Envio wants it: centimetres and kilograms. */
export type QuotePackageItem = {
  id: string;
  width: number;
  height: number;
  length: number;
  weight: number;
  insurance_value: number;
  quantity: number;
};

/** A row of the calculate response. Services the account cannot use come
 *  back in the same array carrying an `error` instead of a price. */
export type MelhorEnvioServiceRaw = {
  id: number;
  name: string;
  price?: string | number;
  custom_price?: string | number;
  discount?: string | number;
  currency?: string;
  delivery_time?: number;
  custom_delivery_time?: number;
  company?: { id: number; name: string; picture?: string };
  error?: string;
};

export type ShippingQuote = {
  serviceId: number;
  name: string;
  company: string;
  companyPicture: string | null;
  price: number;
  deliveryDays: number;
};

function toNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === null) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function calculateShipping(input: {
  fromPostalCode: string;
  toPostalCode: string;
  products: QuotePackageItem[];
}): Promise<ShippingQuote[]> {
  const raw = await request<MelhorEnvioServiceRaw[]>(
    "/api/v2/me/shipment/calculate",
    {
      method: "POST",
      body: {
        from: { postal_code: input.fromPostalCode },
        to: { postal_code: input.toPostalCode },
        products: input.products,
      },
    },
  );

  if (!Array.isArray(raw)) return [];

  return raw
    .filter((service) => !service.error)
    .map((service) => {
      // `custom_price` is what this account actually pays once its own
      // agreement is applied; `price` is the table rate. Charging the
      // table rate when the account is billed less overcharges the
      // shopper, so the custom one wins whenever it is present.
      const price = toNumber(service.custom_price) ?? toNumber(service.price);
      const days =
        service.custom_delivery_time ?? service.delivery_time ?? null;
      if (price === null || days === null) return null;
      return {
        serviceId: service.id,
        name: service.name,
        company: service.company?.name ?? "",
        companyPicture: service.company?.picture ?? null,
        price,
        deliveryDays: days,
      };
    })
    .filter((quote): quote is ShippingQuote => quote !== null)
    .sort((a, b) => a.price - b.price);
}

// ------------------------------------------------------------------
// Labels
// ------------------------------------------------------------------

export type ShipmentParty = {
  name: string;
  phone?: string;
  email?: string;
  document?: string;
  address: string;
  complement?: string;
  number: string;
  district: string;
  city: string;
  state_abbr: string;
  country_id: "BR";
  postal_code: string;
};

export type CartItemResponse = { id: string; protocol?: string; status?: string };

/** Puts the shipment in the Melhor Envio cart. Reserves nothing and
 *  costs nothing — the money only moves at checkout. */
export async function addShipmentToCart(input: {
  service: number;
  from: ShipmentParty;
  to: ShipmentParty;
  products: { name: string; quantity: number; unitary_value: number }[];
  volumes: { height: number; width: number; length: number; weight: number }[];
  insuranceValue: number;
  nonCommercial?: boolean;
}): Promise<CartItemResponse> {
  return request<CartItemResponse>("/api/v2/me/cart", {
    method: "POST",
    body: {
      service: input.service,
      from: input.from,
      to: input.to,
      products: input.products,
      volumes: input.volumes,
      options: {
        insurance_value: input.insuranceValue,
        receipt: false,
        own_hand: false,
        reverse: false,
        non_commercial: input.nonCommercial ?? true,
      },
    },
  });
}

/** Pays for the labels out of the account balance. This spends real
 *  money and is the only irreversible call in this file. */
export async function checkoutShipments(orderIds: string[]): Promise<unknown> {
  return request("/api/v2/me/shipment/checkout", {
    method: "POST",
    body: { orders: orderIds },
  });
}

/** Asks the carrier to issue the labels that were paid for. */
export async function generateShipments(orderIds: string[]): Promise<unknown> {
  return request("/api/v2/me/shipment/generate", {
    method: "POST",
    body: { orders: orderIds },
  });
}

export async function printShipments(orderIds: string[]): Promise<{ url?: string }> {
  return request<{ url?: string }>("/api/v2/me/shipment/print", {
    method: "POST",
    body: { mode: "private", orders: orderIds },
  });
}

export type ShipmentInfo = {
  id: string;
  protocol?: string;
  status?: string;
  tracking?: string | null;
  self_tracking?: string | null;
};

/** Reads back what a shipment turned into — above all the tracking code,
 *  which only exists after the carrier has generated the label. */
export async function getShipmentInfo(
  orderId: string,
): Promise<ShipmentInfo | null> {
  const raw = await request<Record<string, ShipmentInfo>>(
    "/api/v2/me/shipment/tracking",
    { method: "POST", body: { orders: [orderId] } },
  );
  if (!raw || typeof raw !== "object") return null;
  return raw[orderId] ?? Object.values(raw)[0] ?? null;
}
