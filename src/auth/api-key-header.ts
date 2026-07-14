/**
 * Resolve an Elnora API key from inbound request headers.
 *
 * The MCP endpoint accepts an API key two ways:
 *   1. `X-API-Key: elnora_live_...`            (the documented header)
 *   2. `Authorization: Bearer elnora_live_...` (same key in a bearer field)
 *
 * (2) exists because many MCP clients only expose a single "token"/bearer field
 * that maps to `Authorization: Bearer`. Without this, a user pasting their key
 * there hits the OAuth path and gets a confusing `invalid_token` 401.
 *
 * A bearer value WITHOUT the key prefix is a genuine OAuth 2.1 access token and
 * is intentionally left untouched here so it flows on to the OAuth middleware.
 * The two can't be confused: OAuth access tokens are `crypto.randomBytes(32)`
 * base64url strings and never start with the API-key prefix.
 */

/** Prefix carried by every Elnora API key (`elnora_live_` + 32 chars). */
export const API_KEY_TOKEN_PREFIX = "elnora_live_";

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Returns the Elnora API key present in the request headers, or `undefined`
 * when there is none (in which case the caller should fall through to OAuth).
 */
export function resolveApiKeyFromHeaders(
  xApiKey: string | string[] | undefined,
  authorization: string | string[] | undefined,
): string | undefined {
  const fromHeader = firstHeaderValue(xApiKey);
  if (fromHeader) return fromHeader;

  const authz = firstHeaderValue(authorization);
  if (typeof authz === "string") {
    const match = /^Bearer\s+(.+)$/i.exec(authz);
    if (match) {
      const bearer = match[1].trim();
      if (bearer.startsWith(API_KEY_TOKEN_PREFIX)) return bearer;
    }
  }

  return undefined;
}
