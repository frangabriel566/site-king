/**
 * Password hashing for Better Auth, on the runtime's native Web Crypto.
 *
 * Better Auth's default is scrypt implemented in JavaScript, which burns far
 * more than the 10 ms of CPU a Workers Free request gets. PBKDF2 through
 * `crypto.subtle` runs in native code instead. 100 000 iterations is the
 * most the Workers runtime accepts for PBKDF2.
 *
 * Stored format: `pbkdf2-sha256$<iterations>$<salt hex>$<hash hex>`.
 * scripts/create-admin.mjs writes the same format; keep the two in sync.
 */

const ALGORITHM = "pbkdf2-sha256";
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    HASH_BITS,
  );
  return new Uint8Array(bits);
}

/** Constant-time comparison, so a wrong guess takes as long as a near one. */
function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return `${ALGORITHM}$${ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

export async function verifyPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  const [algorithm, iterations, salt, expected] = hash.split("$");
  if (algorithm !== ALGORITHM || !iterations || !salt || !expected) return false;
  const actual = await derive(password, fromHex(salt), Number(iterations));
  return equal(actual, fromHex(expected));
}
