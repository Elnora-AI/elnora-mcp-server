import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import { ElnoraOAuthProvider } from "../../src/auth/provider.js";
import { InMemoryTokenStore } from "../../src/auth/in-memory-token-store.js";
import { InMemoryClientsStore } from "../../src/auth/clients-store.js";
import { validateApiKey } from "../../src/auth/validate-api-key.js";
import type { ElnoraConfig, TokenRecord } from "../../src/types.js";

/**
 * Requests to the platform carry credentials, so none of them may follow a redirect. A local stand-in
 * for the platform answers every request with a 307 to /elsewhere (which would accept anything) and
 * records whatever reaches /elsewhere. axios is real here, not mocked.
 */
let platform: http.Server;
let baseUrl: string;
let reachedElsewhere: string[];

beforeAll(async () => {
  platform = http.createServer((req, res) => {
    if (req.url?.startsWith("/elsewhere")) {
      reachedElsewhere.push(`${req.method} ${req.url}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ valid: true, user_id: "1", access_token: "t", refresh_token: "r" }));
      return;
    }
    if (req.url === "/invalid") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ valid: false }));
      return;
    }
    res.writeHead(307, { Location: `/elsewhere${req.url}` }).end();
  });
  await new Promise<void>((resolve) => platform.listen(0, "127.0.0.1", () => resolve()));
  baseUrl = `http://127.0.0.1:${(platform.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => platform.close(() => resolve()));
});

function configFor(tokenValidationPath: string): ElnoraConfig {
  return {
    apiUrl: baseUrl,
    tokenValidationUrl: `${baseUrl}${tokenValidationPath}`,
    port: 0,
    publicUrl: "https://mcp.example.com",
    loginUrl: "https://platform.example.com/login",
    tokenExchangeUrl: `${baseUrl}/oauth/token`,
    platformClientId: "mcp-server",
    platformClientSecret: "secret",
    mcpServiceKey: "test-service-key",
    redisUrl: "redis://localhost:6379",
    allowHostedClients: false,
  };
}

const client = { client_id: "client-1", redirect_uris: ["http://localhost:9999/cb"] } as OAuthClientInformationFull;
const now = Math.floor(Date.now() / 1000);
const record: TokenRecord = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  platformToken: "platform-token",
  platformRefreshToken: "platform-refresh",
  clientId: client.client_id,
  scopes: ["tasks:read"],
  expiresAt: now + 3600,
  createdAt: now,
};

let store: InMemoryTokenStore;

beforeEach(async () => {
  reachedElsewhere = [];
  store = new InMemoryTokenStore();
  await store.setTokenRecord(record.accessToken, record, 3600);
  await store.setRefreshIndex(record.refreshToken, record.accessToken, 3600);
  await store.setSession("auth-code-1", {
    clientId: client.client_id,
    codeChallenge: "challenge",
    redirectUri: client.redirect_uris[0],
    scopes: ["tasks:read"],
    platformCode: "platform-code",
    platformState: "platform-state",
    browserBinding: "binding",
  }, 600);
});

function providerFor(tokenValidationPath = "/auth/validate-token"): ElnoraOAuthProvider {
  return new ElnoraOAuthProvider(configFor(tokenValidationPath), store, new InMemoryClientsStore(false));
}

describe("platform requests do not follow redirects", () => {
  it("API key validation rejects the key", async () => {
    expect(await validateApiKey("elnora_live_key", configFor("/auth/validate-token"), store)).toBeNull();
    expect(reachedElsewhere).toEqual([]);
  });

  it("access token validation fails closed", async () => {
    await expect(providerFor().verifyAccessToken(record.accessToken)).rejects.toThrow();
    expect(reachedElsewhere).toEqual([]);
  });

  it("refresh token renewal fails and the grant is kept", async () => {
    await expect(providerFor().exchangeRefreshToken(client, record.refreshToken)).rejects.toThrow();
    expect(reachedElsewhere).toEqual([]);
    expect(await store.getRefreshIndex(record.refreshToken)).toBe(record.accessToken);
  });

  it("authorization code exchange fails", async () => {
    await expect(
      providerFor().exchangeAuthorizationCode(client, "auth-code-1", undefined, client.redirect_uris[0]),
    ).rejects.toThrow();
    expect(reachedElsewhere).toEqual([]);
    expect(await store.getSession("auth-code-1")).toBeDefined();
  });

  it("in-place platform token renewal fails and the grant is kept", async () => {
    await expect(providerFor("/invalid").verifyAccessToken(record.accessToken)).rejects.toThrow();
    expect(reachedElsewhere).toEqual([]);
    expect(await store.getTokenRecord(record.accessToken)).toBeDefined();
  });
});
