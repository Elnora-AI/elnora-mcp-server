import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Redis } from "ioredis";
import { RedisTokenStore } from "../../src/auth/redis-token-store.js";
import type { AuthorizationSession, TokenRecord } from "../../src/types.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const TEST_PREFIX = "elnora:mcp:";

let store: RedisTokenStore;
let cleanupRedis: Redis;
let redisAvailable = false;

beforeAll(async () => {
  try {
    cleanupRedis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 2000 });
    await cleanupRedis.ping();
    redisAvailable = true;
    store = new RedisTokenStore(REDIS_URL);
  } catch {
    // Redis not available — tests will be skipped
  }
});

afterAll(async () => {
  if (redisAvailable) {
    await store.disconnect();
    await cleanupRedis.quit();
  }
});

beforeEach(async () => {
  if (!redisAvailable) return;
  // Clean up test keys
  const keys = await cleanupRedis.keys(`${TEST_PREFIX}*`);
  if (keys.length > 0) {
    await cleanupRedis.del(...keys);
  }
});

describe.skipIf(!redisAvailable)("RedisTokenStore integration", () => {
  const mockSession: AuthorizationSession = {
    clientId: "test-client",
    codeChallenge: "challenge-123",
    redirectUri: "http://localhost:3000/callback",
    scopes: ["tasks:read"],
    state: "test-state",
    platformState: "platform-state-123",
    createdAt: Date.now(),
  };

  const mockTokenRecord: TokenRecord = {
    accessToken: "access-token-123",
    refreshToken: "refresh-token-123",
    platformToken: "platform-token-123",
    clientId: "test-client",
    scopes: ["tasks:read"],
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    createdAt: Math.floor(Date.now() / 1000),
  };

  describe("ping", () => {
    it("succeeds when Redis is available", async () => {
      await expect(store.ping()).resolves.not.toThrow();
    });
  });

  describe("sessions", () => {
    it("stores and retrieves a session", async () => {
      await store.setSession("auth-code-1", mockSession, 300);
      const retrieved = await store.getSession("auth-code-1");
      expect(retrieved).toEqual(mockSession);
    });

    it("returns undefined for missing session", async () => {
      const result = await store.getSession("nonexistent");
      expect(result).toBeUndefined();
    });

    it("deletes a session", async () => {
      await store.setSession("auth-code-2", mockSession, 300);
      await store.deleteSession("auth-code-2");
      const result = await store.getSession("auth-code-2");
      expect(result).toBeUndefined();
    });

    it("updates a session atomically", async () => {
      await store.setSession("auth-code-3", mockSession, 300);
      await store.updateSession("auth-code-3", { platformCode: "new-platform-code" });
      const updated = await store.getSession("auth-code-3");
      expect(updated?.platformCode).toBe("new-platform-code");
      expect(updated?.clientId).toBe("test-client"); // Other fields preserved
    });

    it("respects TTL on sessions", async () => {
      await store.setSession("auth-code-ttl", mockSession, 1);
      // Verify key exists
      const before = await store.getSession("auth-code-ttl");
      expect(before).toBeDefined();
      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 1500));
      const after = await store.getSession("auth-code-ttl");
      expect(after).toBeUndefined();
    });
  });

  describe("token records", () => {
    it("stores and retrieves a token record", async () => {
      await store.setTokenRecord("access-token-1", mockTokenRecord, 86400);
      const retrieved = await store.getTokenRecord("access-token-1");
      expect(retrieved).toEqual(mockTokenRecord);
    });

    it("returns undefined for missing token record", async () => {
      const result = await store.getTokenRecord("nonexistent");
      expect(result).toBeUndefined();
    });

    it("deletes a token record", async () => {
      await store.setTokenRecord("access-token-2", mockTokenRecord, 86400);
      await store.deleteTokenRecord("access-token-2");
      const result = await store.getTokenRecord("access-token-2");
      expect(result).toBeUndefined();
    });

    it("stores token records with prefixed keys", async () => {
      await store.setTokenRecord("test-token-value", mockTokenRecord, 86400);
      const keys = await cleanupRedis.keys(`${TEST_PREFIX}token:*`);
      expect(keys.length).toBeGreaterThan(0);
      expect(keys[0]).toBe("elnora:mcp:token:test-token-value");
    });
  });

  describe("refresh index", () => {
    it("stores and retrieves a refresh-to-access mapping", async () => {
      await store.setRefreshIndex("refresh-1", "access-1", 86400);
      const accessToken = await store.getRefreshIndex("refresh-1");
      expect(accessToken).toBe("access-1");
    });

    it("returns undefined for missing refresh token", async () => {
      const result = await store.getRefreshIndex("nonexistent");
      expect(result).toBeUndefined();
    });

    it("deletes a refresh index entry", async () => {
      await store.setRefreshIndex("refresh-2", "access-2", 86400);
      await store.deleteRefreshIndex("refresh-2");
      const result = await store.getRefreshIndex("refresh-2");
      expect(result).toBeUndefined();
    });
  });

  describe("validation cache", () => {
    it("stores and retrieves a validation timestamp", async () => {
      const now = Math.floor(Date.now() / 1000);
      await store.setValidationCache("access-vc-1", now, 30);
      const retrieved = await store.getValidationCache("access-vc-1");
      expect(retrieved).toBe(now);
    });

    it("returns undefined for missing cache entry", async () => {
      const result = await store.getValidationCache("nonexistent");
      expect(result).toBeUndefined();
    });

    it("deletes a validation cache entry", async () => {
      const now = Math.floor(Date.now() / 1000);
      await store.setValidationCache("access-vc-2", now, 30);
      await store.deleteValidationCache("access-vc-2");
      const result = await store.getValidationCache("access-vc-2");
      expect(result).toBeUndefined();
    });
  });

  describe("API-key validation cache", () => {
    it("round-trips an API-key validation result", async () => {
      await store.setApiKeyValidation("key-hash-1", { userId: "42" }, 60);
      const result = await store.getApiKeyValidation("key-hash-1");
      expect(result).toEqual({ userId: "42" });
    });

    it("returns undefined for missing entries", async () => {
      const result = await store.getApiKeyValidation("does-not-exist");
      expect(result).toBeUndefined();
    });

    it("respects TTL", async () => {
      await store.setApiKeyValidation("key-hash-ttl", { userId: "1" }, 1);
      await new Promise((r) => setTimeout(r, 1500));
      const result = await store.getApiKeyValidation("key-hash-ttl");
      expect(result).toBeUndefined();
    });

    it("deletes on request", async () => {
      await store.setApiKeyValidation("key-hash-del", { userId: "1" }, 60);
      await store.deleteApiKeyValidation("key-hash-del");
      const result = await store.getApiKeyValidation("key-hash-del");
      expect(result).toBeUndefined();
    });
  });
});
