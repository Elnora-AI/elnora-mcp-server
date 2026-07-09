import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("axios", () => ({
  default: { post: vi.fn() },
  isAxiosError: () => false,
}));

import axios from "axios";
import { InMemoryTokenStore } from "../../src/auth/in-memory-token-store.js";
import { validateApiKey } from "../../src/auth/validate-api-key.js";
import type { ElnoraConfig } from "../../src/types.js";

const config: ElnoraConfig = {
  apiUrl: "https://api.example.com",
  tokenValidationUrl: "https://api.example.com/auth/validate-token",
  port: 3001,
  publicUrl: "https://mcp.example.com",
  loginUrl: "https://example.com/login",
  tokenExchangeUrl: "https://api.example.com/oauth/token",
  platformClientId: "mcp",
  platformClientSecret: "s",
  mcpServiceKey: "svc",
  redisUrl: "redis://localhost:6379",
};

describe("validateApiKey caching", () => {
  let store: InMemoryTokenStore;
  beforeEach(() => {
    store = new InMemoryTokenStore();
    vi.mocked(axios.post).mockReset();
  });

  it("hits the platform on first call and serves subsequent calls from cache", async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { valid: true, userId: "42" },
    });

    const first = await validateApiKey("elnora_live_testkey", config, store);
    const second = await validateApiKey("elnora_live_testkey", config, store);

    expect(first).toEqual({ userId: "42" });
    expect(second).toEqual({ userId: "42" });
    expect(vi.mocked(axios.post)).toHaveBeenCalledTimes(1);
  });

  it("accepts snake_case user_id from the platform response", async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { valid: true, user_id: "7" },
    });
    const result = await validateApiKey("elnora_live_snake", config, store);
    expect(result).toEqual({ userId: "7" });
  });

  it("does not cache failed validations", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { valid: false } });

    const first = await validateApiKey("elnora_live_bad", config, store);
    const second = await validateApiKey("elnora_live_bad", config, store);

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(vi.mocked(axios.post)).toHaveBeenCalledTimes(2);
  });

  it("keys the cache by hashed key — the raw key is never stored", async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { valid: true, userId: "42" },
    });
    await validateApiKey("elnora_live_secret", config, store);

    const internalMap = (store as unknown as { apiKeyValidations: Map<string, unknown> }).apiKeyValidations;
    for (const key of internalMap.keys()) {
      expect(key).not.toContain("elnora_live_secret");
      expect(key).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
    }
    expect(internalMap.size).toBe(1);
  });

  it("falls back to the direct platform call when cache read throws", async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { valid: true, userId: "42" },
    });
    const brokenStore = {
      getApiKeyValidation: vi.fn().mockRejectedValue(new Error("redis down")),
      setApiKeyValidation: vi.fn().mockRejectedValue(new Error("redis down")),
    };
    const result = await validateApiKey("elnora_live_testkey", config, brokenStore as never);
    expect(result).toEqual({ userId: "42" });
    expect(vi.mocked(axios.post)).toHaveBeenCalledTimes(1);
  });

  it("returns null when the platform rejects the request", async () => {
    vi.mocked(axios.post).mockRejectedValueOnce(new Error("platform offline"));
    const result = await validateApiKey("elnora_live_testkey", config, store);
    expect(result).toBeNull();
  });
});
