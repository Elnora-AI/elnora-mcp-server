import crypto from "node:crypto";

/**
 * User-agent binding for the authorization flow.
 *
 * The /authorize step issues a one-time, host-locked cookie identifying the browser that
 * initiated the request; /oauth/callback requires that same cookie before the platform
 * authorization code is accepted into the session. This binds the request to the initiating
 * user agent (OAuth 2.0 Security BCP, RFC 9700) so a callback completed by a different browser
 * than the one that started the flow is rejected.
 */

const BASE_COOKIE_NAME = "mcp_authz_binding";

/**
 * Cookie name for the binding.
 * In production (https) the `__Host-` prefix is used: browsers only accept such a cookie when it
 * is Secure, Path=/ and host-only (no Domain), and reject any attempt by a related host to set it
 * with a Domain attribute — preventing a sibling subdomain from shadowing it. The `__Host-` prefix
 * cannot be set over plain http, so local development falls back to the bare name.
 */
export function authzBindingCookieName(publicUrl: string): string {
  return publicUrl.startsWith("https:") ? `__Host-${BASE_COOKIE_NAME}` : BASE_COOKIE_NAME;
}

/** Fresh high-entropy binding value. */
export function newBindingValue(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Cookie attributes. Session cookie (no Max-Age/Expires) — the authoritative lifetime is the
 * server-side session TTL. HttpOnly; SameSite=Lax (sent on the top-level GET callback redirect);
 * Secure and Path=/ in production (both required by the `__Host-` prefix); no Domain.
 */
export function bindingCookieOptions(publicUrl: string): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: publicUrl.startsWith("https:"),
    path: "/",
  };
}

/**
 * Read exactly one cookie value by name from a Cookie header.
 * Returns the value, `undefined` if the name is absent, or `null` if the name appears more than
 * once (ambiguous/duplicate → the caller must reject).
 */
export function readSingleCookie(header: string | undefined, name: string): string | undefined | null {
  if (!header) return undefined;
  const matches: string[] = [];
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      matches.push(part.slice(idx + 1).trim());
    }
  }
  if (matches.length === 0) return undefined;
  if (matches.length > 1) return null;
  return matches[0];
}

/**
 * Constant-time comparison of the presented binding against the stored value.
 * Hashes both sides to a fixed length first so it never throws on differing input lengths, and
 * returns false (not an exception) when either side is missing.
 */
export function safeBindingEqual(presented: string | undefined | null, stored: string | undefined): boolean {
  if (!presented || !stored) return false;
  const a = crypto.createHash("sha256").update(presented).digest();
  const b = crypto.createHash("sha256").update(stored).digest();
  return crypto.timingSafeEqual(a, b);
}
