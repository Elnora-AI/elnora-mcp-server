import { Redis } from "ioredis";
import { AuthorizationSession, TokenRecord } from "../types.js";
import { TokenStore } from "./token-store.js";

// Redis key prefixes — tokens are base64url strings (already URL-safe, fixed-length)
const PREFIX_SESSION = "elnora:mcp:session:";
const PREFIX_TOKEN = "elnora:mcp:token:";
const PREFIX_REFRESH = "elnora:mcp:refresh:";
const PREFIX_VCACHE = "elnora:mcp:vcache:";
const PREFIX_APIKEY_VCACHE = "elnora:mcp:apikey-vcache:";

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
 * Key layout:
 * - elnora:mcp:session:{authCode}       → JSON AuthorizationSession (5 min TTL)
 * - elnora:mcp:token:{accessToken}      → JSON TokenRecord (30 day TTL)
 * - elnora:mcp:refresh:{refreshToken}   → accessToken (30 day TTL)
 * - elnora:mcp:vcache:{accessToken}     → epoch seconds (30 sec TTL)
 * - elnora:mcp:apikey-vcache:{keyHash}  → JSON { userId } (90 sec TTL)
 *
 * Tokens used as key suffixes are base64url-encoded crypto.randomBytes(32).
 * Redis is in a private VPC with TLS + password auth; key enumeration
 * requires the same access level as reading values.
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

  // --- Sessions ---
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
    // Redis server-side Lua script runs atomically — standard ioredis API
    // for atomic read-modify-write operations.
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

  // --- Token records ---
  async getTokenRecord(accessToken: string): Promise<TokenRecord | undefined> {
    const data = await this.redis.get(`${PREFIX_TOKEN}${accessToken}`);
    return data ? JSON.parse(data) : undefined;
  }

  async setTokenRecord(accessToken: string, record: TokenRecord, ttlSeconds: number): Promise<void> {
    await this.redis.set(`${PREFIX_TOKEN}${accessToken}`, JSON.stringify(record), "EX", ttlSeconds);
  }

  async deleteTokenRecord(accessToken: string): Promise<void> {
    await this.redis.del(`${PREFIX_TOKEN}${accessToken}`);
  }

  // --- Refresh index (refreshToken → accessToken mapping) ---
  async getRefreshIndex(refreshToken: string): Promise<string | undefined> {
    const data = await this.redis.get(`${PREFIX_REFRESH}${refreshToken}`);
    return data ?? undefined;
  }

  async setRefreshIndex(refreshToken: string, accessToken: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(`${PREFIX_REFRESH}${refreshToken}`, accessToken, "EX", ttlSeconds);
  }

  async deleteRefreshIndex(refreshToken: string): Promise<void> {
    await this.redis.del(`${PREFIX_REFRESH}${refreshToken}`);
  }

  // --- Validation cache ---
  async getValidationCache(accessToken: string): Promise<number | undefined> {
    const data = await this.redis.get(`${PREFIX_VCACHE}${accessToken}`);
    return data ? parseInt(data, 10) : undefined;
  }

  async setValidationCache(accessToken: string, epochSeconds: number, ttlSeconds: number): Promise<void> {
    await this.redis.set(`${PREFIX_VCACHE}${accessToken}`, epochSeconds.toString(), "EX", ttlSeconds);
  }

  async deleteValidationCache(accessToken: string): Promise<void> {
    await this.redis.del(`${PREFIX_VCACHE}${accessToken}`);
  }

  // --- API-key validation cache ---
  async getApiKeyValidation(keyHash: string): Promise<{ userId: string } | undefined> {
    const data = await this.redis.get(`${PREFIX_APIKEY_VCACHE}${keyHash}`);
    if (!data) return undefined;
    try {
      return JSON.parse(data) as { userId: string };
    } catch {
      // Malformed cache entry — ignore and force re-validation.
      return undefined;
    }
  }

  async setApiKeyValidation(keyHash: string, data: { userId: string }, ttlSeconds: number): Promise<void> {
    await this.redis.set(
      `${PREFIX_APIKEY_VCACHE}${keyHash}`,
      JSON.stringify(data),
      "EX",
      ttlSeconds,
    );
  }

  async deleteApiKeyValidation(keyHash: string): Promise<void> {
    await this.redis.del(`${PREFIX_APIKEY_VCACHE}${keyHash}`);
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
