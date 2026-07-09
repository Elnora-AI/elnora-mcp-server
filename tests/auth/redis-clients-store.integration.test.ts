import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Redis } from "ioredis";
import { RedisClientsStore } from "../../src/auth/redis-clients-store.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const TEST_PREFIX = "elnora:mcp:client:";

let store: RedisClientsStore;
let cleanupRedis: Redis;
let redisAvailable = false;

beforeAll(async () => {
  try {
    cleanupRedis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 2000 });
    await cleanupRedis.ping();
    redisAvailable = true;
    store = new RedisClientsStore(REDIS_URL);
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

describe.skipIf(!redisAvailable)("RedisClientsStore integration", () => {
  describe("ping", () => {
    it("succeeds when Redis is available", async () => {
      await expect(store.ping()).resolves.not.toThrow();
    });
  });

  describe("getClient", () => {
    it("returns undefined for unregistered client", async () => {
      const result = await store.getClient("nonexistent");
      expect(result).toBeUndefined();
    });
  });

  describe("registerClient", () => {
    it("registers a client and returns it with generated id and secret", async () => {
      const registered = await store.registerClient({
        redirect_uris: ["http://localhost:3000/callback"],
        token_endpoint_auth_method: "client_secret_post",
      });

      expect(registered.client_id).toBeDefined();
      expect(registered.client_secret).toBeDefined();
      expect(registered.client_id_issued_at).toBeGreaterThan(0);
      expect(registered.client_secret_expires_at).toBeGreaterThan(registered.client_id_issued_at!);
      expect(registered.redirect_uris).toEqual(["http://localhost:3000/callback"]);
    });

    it("retrieves a registered client by ID", async () => {
      const registered = await store.registerClient({
        redirect_uris: ["http://localhost:3000/callback"],
      });

      const retrieved = await store.getClient(registered.client_id);
      expect(retrieved).toEqual(registered);
    });

    it("round-trips all client fields correctly", async () => {
      const registered = await store.registerClient({
        redirect_uris: ["https://app.example.com/callback", "http://localhost:3000/callback"],
        token_endpoint_auth_method: "client_secret_post",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: "tasks:read tasks:write",
      });

      const retrieved = await store.getClient(registered.client_id);
      expect(retrieved).toEqual(registered);
      expect(retrieved!.redirect_uris).toEqual(["https://app.example.com/callback", "http://localhost:3000/callback"]);
      expect(retrieved!.token_endpoint_auth_method).toBe("client_secret_post");
      expect(retrieved!.grant_types).toEqual(["authorization_code", "refresh_token"]);
    });

    it("generates unique IDs for each registered client", async () => {
      const client1 = await store.registerClient({ redirect_uris: ["http://localhost:3001/callback"] });
      const client2 = await store.registerClient({ redirect_uris: ["http://localhost:3002/callback"] });

      expect(client1.client_id).not.toBe(client2.client_id);
      expect(client1.client_secret).not.toBe(client2.client_secret);
    });

    it("sets TTL on client key", async () => {
      const registered = await store.registerClient({
        redirect_uris: ["http://localhost:3000/callback"],
      });

      const ttl = await cleanupRedis.ttl(`${TEST_PREFIX}${registered.client_id}`);
      expect(ttl).toBeGreaterThan(0);
      // 90 days = 7776000 seconds — allow small variance for test execution time
      expect(ttl).toBeLessThanOrEqual(90 * 24 * 3600);
      expect(ttl).toBeGreaterThan(90 * 24 * 3600 - 60);
    });
  });

  describe("redirect URI validation", () => {
    it("rejects non-localhost HTTP redirect URIs", async () => {
      await expect(
        store.registerClient({ redirect_uris: ["http://evil.example.com/callback"] }),
      ).rejects.toThrow("HTTP redirect_uri only allowed for localhost");
    });

    it("rejects javascript: redirect URIs", async () => {
      await expect(
        store.registerClient({ redirect_uris: ["javascript:alert(1)"] }),
      ).rejects.toThrow("redirect_uri must use HTTPS");
    });

    it("rejects data: redirect URIs", async () => {
      await expect(
        store.registerClient({ redirect_uris: ["data:text/html,<h1>hi</h1>"] }),
      ).rejects.toThrow("redirect_uri must use HTTPS");
    });

    it("accepts HTTPS redirect URIs", async () => {
      const registered = await store.registerClient({
        redirect_uris: ["https://app.example.com/callback"],
      });
      expect(registered.redirect_uris).toEqual(["https://app.example.com/callback"]);
    });

    it("accepts localhost HTTP redirect URIs", async () => {
      const registered = await store.registerClient({
        redirect_uris: ["http://localhost:3000/callback"],
      });
      expect(registered.redirect_uris).toEqual(["http://localhost:3000/callback"]);
    });
  });
});
