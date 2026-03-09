import crypto from "node:crypto";
import { Redis } from "ioredis";
import { AuthorizationSession, TokenRecord } from "../types.js";
import { TokenStore } from "./token-store.js";

/**
 * Derive an opaque Redis key from a token value — raw tokens are never used as keys.
 * NOT password hashing: inputs are crypto.randomBytes(32) tokens with 256 bits of entropy.
 * SHA-256 is used only to create a fixed-length hex key for Redis, not to protect a secret.
 */
function hashKey(token: string): string {
  // CodeQL js/insufficient-password-hash: false positive — these are cryptographically
  // random tokens (not user-chosen passwords), used as Redis key identifiers only.
  return crypto.createHash("sha256").update(token).digest("hex"); // lgtm[js/insufficient-password-hash]
}

// Redis key prefixes
const PREFIX_SESSION = "elnora:mcp:session:";
const PREFIX_TOKEN = "elnora:mcp:token:";
const PREFIX_REFRESH = "elnora:mcp:refresh:";
const PREFIX_VCACHE = "elnora:mcp:vcache:";

/**
 * Lua script for atomic session update (read-modify-write).
 * Prevents race conditions on concurrent callbacks.
 * KEYS[1] = session key, ARGV[1] = JSON partial update
 * Returns 1 on success, 0 if key doesn't exist.
 */
const UPDATE_SESSION_LUA = `
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
local session = cjson.decode(current)
local update = cjson.decode(ARGV[1])
for k, v in pairs(update) do
  session[k] = v
end
local ttl = redis.call('TTL', KEYS[1])
if ttl > 0 then
  redis.call('SET', KEYS[1], cjson.encode(session), 'EX', ttl)
else
  redis.call('SET', KEYS[1], cjson.encode(session))
end
return 1
`;

/**
 * Redis-backed TokenStore for production use.
 * Persists tokens across server restarts via Redis.
 *
 * Key design (all token keys use sha256 hash):
 * - elnora:mcp:session:{authCode}         → JSON AuthorizationSession (5 min TTL)
 * - elnora:mcp:token:{sha256(accessToken)} → JSON TokenRecord (30 day TTL)
 * - elnora:mcp:refresh:{sha256(refreshToken)} → sha256(accessToken) (30 day TTL)
 * - elnora:mcp:vcache:{sha256(accessToken)} → epoch seconds (30 sec TTL)
 */
export class RedisTokenStore implements TokenStore {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        // Exponential backoff: 100ms, 200ms, 400ms, ... capped at 5s
        return Math.min(times * 100, 5000);
      },
      enableReadyCheck: true,
      lazyConnect: false,
    });
  }

  // --- Sessions (auth code is already random, no need to hash) ---
  async getSession(authCode: string): Promise<AuthorizationSession | undefined> {
    const data = await this.redis.get(`${PREFIX_SESSION}${authCode}`);
    return data ? JSON.parse(data) : undefined;
  }

  async setSession(authCode: string, session: AuthorizationSession, ttlSeconds: number): Promise<void> {
    await this.redis.set(`${PREFIX_SESSION}${authCode}`, JSON.stringify(session), "EX", ttlSeconds);
  }

  async deleteSession(authCode: string): Promise<void> {
    await this.redis.del(`${PREFIX_SESSION}${authCode}`);
  }

  async updateSession(authCode: string, update: Partial<AuthorizationSession>): Promise<void> {
    // Redis EVAL runs a Lua script atomically — this is the standard ioredis API
    // for atomic read-modify-write operations (not JavaScript eval()).
    const result = await this.redis.call(
      "EVAL",
      UPDATE_SESSION_LUA,
      "1",
      `${PREFIX_SESSION}${authCode}`,
      JSON.stringify(update),
    );
    // result === 0 means key didn't exist; silently ignore (matches InMemoryTokenStore behavior)
    void result;
  }

  // --- Token records (hash access tokens) ---
  async getTokenRecord(accessToken: string): Promise<TokenRecord | undefined> {
    const data = await this.redis.get(`${PREFIX_TOKEN}${hashKey(accessToken)}`);
    return data ? JSON.parse(data) : undefined;
  }

  async setTokenRecord(accessToken: string, record: TokenRecord, ttlSeconds: number): Promise<void> {
    await this.redis.set(`${PREFIX_TOKEN}${hashKey(accessToken)}`, JSON.stringify(record), "EX", ttlSeconds);
  }

  async deleteTokenRecord(accessToken: string): Promise<void> {
    await this.redis.del(`${PREFIX_TOKEN}${hashKey(accessToken)}`);
  }

  // --- Refresh index (hash refresh tokens → raw access token value) ---
  async getRefreshIndex(refreshToken: string): Promise<string | undefined> {
    const data = await this.redis.get(`${PREFIX_REFRESH}${hashKey(refreshToken)}`);
    return data ?? undefined;
  }

  async setRefreshIndex(refreshToken: string, accessToken: string, ttlSeconds: number): Promise<void> {
    // Store the raw access token (not hash) because the provider passes it to getTokenRecord
    // which will hash it internally
    await this.redis.set(`${PREFIX_REFRESH}${hashKey(refreshToken)}`, accessToken, "EX", ttlSeconds);
  }

  async deleteRefreshIndex(refreshToken: string): Promise<void> {
    await this.redis.del(`${PREFIX_REFRESH}${hashKey(refreshToken)}`);
  }

  // --- Validation cache (hash access tokens) ---
  async getValidationCache(accessToken: string): Promise<number | undefined> {
    const data = await this.redis.get(`${PREFIX_VCACHE}${hashKey(accessToken)}`);
    return data ? parseInt(data, 10) : undefined;
  }

  async setValidationCache(accessToken: string, epochSeconds: number, ttlSeconds: number): Promise<void> {
    await this.redis.set(`${PREFIX_VCACHE}${hashKey(accessToken)}`, epochSeconds.toString(), "EX", ttlSeconds);
  }

  async deleteValidationCache(accessToken: string): Promise<void> {
    await this.redis.del(`${PREFIX_VCACHE}${hashKey(accessToken)}`);
  }

  // --- Lifecycle ---
  async ping(): Promise<void> {
    const result = await this.redis.ping();
    if (result !== "PONG") {
      throw new Error(`Redis ping failed: ${result}`);
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
