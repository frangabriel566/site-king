import "server-only";
import { isAPIError } from "better-auth/api";

/** Better Auth's machine-readable error code ("INVALID_EMAIL_OR_PASSWORD",
 * "USER_ALREADY_EXISTS", "INVALID_TOKEN"…), or undefined for anything that
 * is not one of its API errors. */
export function authErrorCode(error: unknown): string | undefined {
  if (!isAPIError(error)) return undefined;
  const code = (error.body as { code?: unknown } | undefined)?.code;
  return typeof code === "string" ? code : undefined;
}
