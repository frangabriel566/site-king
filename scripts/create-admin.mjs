#!/usr/bin/env node
/**
 * Creates the store's admin account in D1 — or, if the e-mail already has
 * an account (say, one made through the shop's "Criar conta"), promotes it
 * to admin and sets the given password.
 *
 *   npm run admin:create -- --email voce@loja.com.br --name "Seu Nome"           (local)
 *   npm run admin:create -- --email voce@loja.com.br --name "Seu Nome" --remote  (produção)
 *
 * The password is read from the ADMIN_PASSWORD environment variable, or
 * asked for interactively. It never goes on the command line (shell
 * history) and is only ever stored as a hash.
 *
 * The hash format must match lib/auth/password.ts exactly:
 *   pbkdf2-sha256$<iterations>$<salt hex>$<hash hex>
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { webcrypto as crypto } from "node:crypto";

const DATABASE = "king-store-db";
const ITERATIONS = 100_000;

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const remote = process.argv.includes("--remote");
const email = arg("email")?.trim().toLowerCase();
const name = arg("name")?.trim() || "Administrador";

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Uso: npm run admin:create -- --email voce@loja.com.br --name "Seu Nome" [--remote]');
  process.exit(1);
}

let password = process.env.ADMIN_PASSWORD;
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question("Senha do admin (mínimo 8 caracteres): ");
  rl.close();
}
if (!password || password.length < 8) {
  console.error("A senha precisa ter ao menos 8 caracteres.");
  process.exit(1);
}

const toHex = (bytes) => Buffer.from(bytes).toString("hex");

async function hashPassword(plain) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(plain), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    key,
    256,
  );
  return `pbkdf2-sha256$${ITERATIONS}$${toHex(salt)}$${toHex(new Uint8Array(bits))}`;
}

const sqlString = (value) => `'${String(value).replace(/'/g, "''")}'`;

function d1(args) {
  const argv = ["wrangler", "d1", "execute", DATABASE, remote ? "--remote" : "--local", ...args];
  const options = { encoding: "utf8", env: { ...process.env, CI: "true" } };
  // npx is a .cmd on Windows and needs a shell — given one command line,
  // already quoted where it must be.
  const result =
    process.platform === "win32"
      ? spawnSync(`npx ${argv.join(" ")}`, { ...options, shell: true })
      : spawnSync("npx", argv, options);
  if (result.status !== 0) {
    console.error(result.stdout, result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

const select = `SELECT id FROM user WHERE email = ${sqlString(email)}`;
const lookup = JSON.parse(
  // Through cmd.exe on Windows the query needs its own quotes; elsewhere
  // the argument is passed as-is.
  d1(["--json", "--command", process.platform === "win32" ? `"${select}"` : select]),
);
const existingId = lookup?.[0]?.results?.[0]?.id;

const now = Date.now();
const hash = await hashPassword(password);
const statements = [];

if (existingId) {
  statements.push(
    `UPDATE user SET role = 'admin', updated_at = ${now} WHERE id = ${sqlString(existingId)};`,
    `DELETE FROM account WHERE user_id = ${sqlString(existingId)} AND provider_id = 'credential';`,
    `INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (${sqlString(crypto.randomUUID())}, ${sqlString(existingId)}, 'credential', ${sqlString(existingId)}, ${sqlString(hash)}, ${now}, ${now});`,
  );
} else {
  const id = crypto.randomUUID();
  statements.push(
    `INSERT INTO user (id, name, email, email_verified, role, created_at, updated_at) VALUES (${sqlString(id)}, ${sqlString(name)}, ${sqlString(email)}, 0, 'admin', ${now}, ${now});`,
    `INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (${sqlString(crypto.randomUUID())}, ${sqlString(id)}, 'credential', ${sqlString(id)}, ${sqlString(hash)}, ${now}, ${now});`,
  );
}

// A file, not --command: the hash and names would not survive shell quoting.
mkdirSync(".wrangler/tmp", { recursive: true });
const file = ".wrangler/tmp/create-admin.sql";
writeFileSync(file, statements.join("\n"));
try {
  d1(["--file", file]);
} finally {
  rmSync(file, { force: true });
}

console.log(
  `${existingId ? "Conta promovida a admin" : "Admin criado"}: ${email} (${remote ? "produção" : "local"}). Entre em /admin/login.`,
);
