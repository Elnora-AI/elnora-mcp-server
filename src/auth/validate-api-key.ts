import axios from "axios";
import crypto from "node:crypto";
import type { ElnoraConfig } from "../types.js";
import type { TokenStore } from "./token-store.js";
import { logAuthEvent } from "../middleware/tool-logging.js";

const CACHE_TTL_SECONDS = 90;

/**
 * Derives a deterministic, irreversible cache key from a credential string.
 *
 * NOT a password hash — that would need a slow KDF (bcrypt/argon2) with a
 * per-entry salt, which breaks the two properties we need here:
 *   1. Deterministic: the same credential must map to the same cache key so
 *      a lookup on the second request finds the first request's entry.
 *   2. Fast: this runs on every inbound request; a slow KDF would dominate
 *      request latency.
 *
 * The purpose is to avoid persisting the raw credential in the cache store.
 * Credentials are 40+ characters of cryptographic randomness, so a rainbow
 * table attack against sha256 is computationally infeasible at this length.
 */
function deriveCacheKey(credential: string): string {
  return crypto.createHash("sha256").update(credential).digest("hex");
}

/**
 * Validate an API key against the Elnora platform.
 *
 * Uses a short-lived cache (TTL {@link CACHE_TTL_SECONDS}s) keyed by a
 * sha256 hash of the raw key so repeated validations within the window skip
 * the platform round-trip. The raw key is never persisted. Only successful
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
  const keyHash = deriveCacheKey(apiKey);

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
