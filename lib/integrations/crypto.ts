import "server-only";

/**
 * The integration tokens at rest: AES-GCM (256-bit) with a key that lives
 * only in the Worker's `INTEGRATIONS_KEY` secret — the database holds
 * ciphertext, so a copy of D1 (a backup, an export) gives no access to the
 * Mercado Pago or Melhor Envio accounts.
 *
 * The provider's name goes in as additional data: a ciphertext copied from
 * one row to the other fails to decrypt instead of being used for the
 * wrong service.
 *
 * Plain Web Crypto, which the Workers runtime has built in — nothing is
 * added to the bundle.
 */

const KEY_BYTES = 32;
const IV_BYTES = 12;
const VERSION = "v1";

export class IntegrationKeyMissingError extends Error {
  constructor() {
    super("A chave de criptografia (INTEGRATIONS_KEY) não está configurada.");
    this.name = "IntegrationKeyMissingError";
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function keyBytes(): Uint8Array<ArrayBuffer> | null {
  const raw = process.env.INTEGRATIONS_KEY?.trim();
  if (!raw) return null;
  try {
    const bytes = fromBase64(raw);
    return bytes.length === KEY_BYTES ? bytes : null;
  } catch {
    return null;
  }
}

/** Whether tokens can be saved: the secret exists and is 32 bytes. */
export function isEncryptionKeyConfigured(): boolean {
  return keyBytes() !== null;
}

async function importKey(): Promise<CryptoKey> {
  const bytes = keyBytes();
  if (!bytes) throw new IntegrationKeyMissingError();
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** `v1.<iv>.<ciphertext>`, both base64. */
export async function encryptSecrets(
  provider: string,
  secrets: Record<string, string>,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(provider) },
    await importKey(),
    new TextEncoder().encode(JSON.stringify(secrets)),
  );
  return `${VERSION}.${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptSecrets(
  provider: string,
  blob: string,
): Promise<Record<string, string>> {
  const [version, iv, ciphertext] = blob.split(".");
  if (version !== VERSION || !iv || !ciphertext) throw new Error("Credenciais em formato desconhecido.");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv), additionalData: new TextEncoder().encode(provider) },
    await importKey(),
    fromBase64(ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plain)) as Record<string, string>;
}

/** The last 4 characters — all the panel ever shows of a saved token. */
export function secretHint(value: string): string {
  return value.slice(-4);
}
