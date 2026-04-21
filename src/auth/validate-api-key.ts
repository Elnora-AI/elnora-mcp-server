import axios from "axios";
import crypto from "node:crypto";
import type { ElnoraConfig } from "../types.js";
import type { TokenStore } from "./token-store.js";
import { logAuthEvent } from "../middleware/tool-logging.js";

const CACHE_TTL_SECONDS = 90;

/**
 * Derives a deterministic, irreversible cache key from a credential string
 * using HMAC-SHA256 with a server-side secret.
 *
 * NOT a password hash. This is a keyed-hash for cache-key derivation, which
 * needs to be (1) deterministic so lookups hit, and (2) fast because it
 * runs on every inbound request. A slow password KDF (bcrypt/argon2) would
 * break both properties.
 *
 * Using HMAC instead of a bare hash namespaces cache keys to this
 * deployment (different MCP instances derive different keys for the same
 * input) and removes the raw credential from the persisted cache entry.
 */
function deriveCacheKey(credential: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(credential).digest("hex");
}

/**
 * Validate an API key against the Elnora platform.
 *
 * Uses a short-lived cache (TTL {@link CACHE_TTL_SECONDS}s) keyed by an
 * HMAC of the raw key so repeated validations within the window skip the
 * platform round-trip. The raw key is never persisted. Only successful
 * validations are cached; failures always re-hit the platform so a user
 * who regenerates a revoked key isn't stuck with a stale 'no' answer.
 *
 * Cache errors (read or write) are logged but never block the request —
 * the function falls through to the direct validation path, matching
 * pre-cache behavior.
 */
export async function validateApiKey(
  apiKey: string,
  config: ElnoraConfig,
  store: Pick<TokenStore, "getApiKeyValidation" | "setApiKeyValidation">,
): Promise<{ userId: string } | null> {
  const keyHash = deriveCacheKey(apiKey, config.mcpServiceKey);

  try {
    const cached = await store.getApiKeyValidation(keyHash);
    if (cached) return cached;
  } catch (err) {
    logAuthEvent("api_key_cache_error", "unknown", {
      error: err instanceof Error ? err.message : "Unknown error",
      phase: "read",
    });
  }

  try {
    const validation = await axios.post(
      config.tokenValidationUrl,
      { token: apiKey },
      { timeout: 10_000, headers: { "X-Service-Key": config.mcpServiceKey } },
    );
    // Platform response may use camelCase (.NET default) or snake_case.
    const userId = validation.data.user_id ?? validation.data.userId;
    if (validation.data.valid && userId) {
      const result = { userId: String(userId) };
      try {
        await store.setApiKeyValidation(keyHash, result, CACHE_TTL_SECONDS);
      } catch (err) {
        logAuthEvent("api_key_cache_error", "unknown", {
          error: err instanceof Error ? err.message : "Unknown error",
          phase: "write",
        });
      }
      return result;
    }
    return null;
  } catch (err) {
    logAuthEvent("api_key_validation_error", "unknown", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
    return null;
  }
}
