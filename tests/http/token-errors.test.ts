import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import axios from "axios";
import { createApp } from "../../src/app.js";
import { InMemoryTokenStore } from "../../src/auth/in-memory-token-store.js";
import { InMemoryClientsStore } from "../../src/auth/clients-store.js";
import type { ElnoraConfig } from "../../src/types.js";
import { httpError, networkError, rejectedRefresh } from "../helpers/fake-platform.js";

/**
 * POST /token error responses (RFC 6749 §5.2). A refresh token or authorization code that is unknown,
 * revoked, or bound to another client is the client's problem, not the server's: it must be a 400 with
 * error=invalid_grant, so an MCP client discards its tokens and re-authorizes instead of retrying a dead
 * grant against a 500. Only a transient platform outage stays a 500 (server_error), which is retryable.
 */
const config: ElnoraConfig = {
  apiUrl: "https://api.example.com",
  tokenValidationUrl: "https://api.example.com/auth/validate-token",
  port: 0,
  publicUrl: "https://mcp.example.com",
  loginUrl: "https://platform.example.com/login",
  tokenExchangeUrl: "https://api.example.com/oauth/token",
  platformClientId: "mcp-server",
  platformClientSecret: "secret",
  mcpServiceKey: "test-service-key",
  redisUrl: "redis://localhost:6379",
  allowHostedClients: false,
};

const REDIRECT = "http://localhost:9999/cb";
const CODE_VERIFIER = crypto.randomBytes(32).toString("base64url");
const CODE_CHALLENGE = crypto.createHash("sha256").update(CODE_VERIFIER).digest("base64url");

let server: Server;
let baseUrl: string;
let store: InMemoryTokenStore;
let clientId: string;
let clientSecret: string;

beforeAll(async () => {
  store = new InMemoryTokenStore();
  const clientsStore = new InMemoryClientsStore(false);
  const registered = await clientsStore.registerClient!({ redirect_uris: [REDIRECT], client_name: "CLI Test" });
  clientId = registered.client_id;
  clientSecret = registered.client_secret!;

  const app = createApp(config, store, clientsStore);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// Every platform call must be mocked by the test that expects it; anything else fails loudly instead of
// reaching the network.
let platformPost: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  platformPost = vi.spyOn(axios, "post").mockRejectedValue(new Error("unexpected platform call"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Collect the auth_event lines logged while `fn` runs. */
async function captureAuthEvents(fn: () => Promise<unknown>): Promise<Array<Record<string, unknown>>> {
  const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await fn();
    return errorLog.mock.calls
      .map(([line]) => (typeof line === "string" && line.startsWith("{") ? JSON.parse(line) : undefined))
      .filter((entry): entry is Record<string, unknown> => entry?.type === "auth_event");
  } finally {
    errorLog.mockRestore();
  }
}

/** The platform renewing its token pair (refresh_token grant). */
const platformRenewal = {
  data: { access_token: "renewed-platform-token", refresh_token: "renewed-platform-refresh-token", expires_in: 3600 },
};

async function postToken(params: Record<string, string>): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** Seed a token record + refresh index exactly as issueTokens() writes them; returns the refresh token. */
async function seedRefreshToken(owner = clientId, scopes = ["tasks:read"]): Promise<string> {
  const accessToken = crypto.randomBytes(32).toString("base64url");
  const refreshToken = crypto.randomBytes(32).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  await store.setTokenRecord(accessToken, {
    accessToken,
    refreshToken,
    platformToken: "platform-token",
    platformRefreshToken: "platform-refresh-token",
    clientId: owner,
    scopes,
    expiresAt: now + 3600,
    createdAt: now,
  }, 30 * 24 * 3600);
  await store.setRefreshIndex(refreshToken, accessToken, 30 * 24 * 3600);
  return refreshToken;
}

/** Seed a pending authorization session; returns the MCP authorization code. */
async function seedAuthCode(overrides: { clientId?: string; platformCode?: string } = {}): Promise<string> {
  const code = crypto.randomBytes(32).toString("base64url");
  await store.setSession(code, {
    clientId: overrides.clientId ?? clientId,
    codeChallenge: CODE_CHALLENGE,
    redirectUri: REDIRECT,
    scopes: ["tasks:read"],
    platformState: "platform-state",
    browserBinding: "binding",
    consented: true,
    createdAt: Date.now(),
    ...(overrides.platformCode !== undefined ? { platformCode: overrides.platformCode } : {}),
  }, 300);
  return code;
}

describe("POST /token — refresh_token grant errors", () => {
  it("rejects an unknown refresh token with 400 invalid_grant", async () => {
    const { status, body } = await postToken({ grant_type: "refresh_token", refresh_token: "unknown-refresh-token" });
    expect({ status, error: body.error }).toEqual({ status: 400, error: "invalid_grant" });
  });

  it("rejects a refresh token issued to another client with 400 invalid_grant", async () => {
    const refreshToken = await seedRefreshToken("some-other-client");
    const { status, body } = await postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
    expect({ status, error: body.error }).toEqual({ status: 400, error: "invalid_grant" });
  });

  it("renews the platform token pair on every refresh", async () => {
    const refreshToken = await seedRefreshToken();
    platformPost.mockResolvedValueOnce(platformRenewal);
    const first = await postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
    expect(first.status).toBe(200);

    platformPost.mockResolvedValueOnce(platformRenewal);
    const second = await postToken({ grant_type: "refresh_token", refresh_token: first.body.refresh_token as string });
    expect(second.status).toBe(200);
    expect(platformPost.mock.calls.map(([url, body]) => [url, (body as Record<string, unknown>).refresh_token])).toEqual([
      [config.tokenExchangeUrl, "platform-refresh-token"],
      [config.tokenExchangeUrl, "renewed-platform-refresh-token"],
    ]);
  });

  it("rejects a refresh the platform no longer accepts with 400 invalid_grant, and the grant stays dead", async () => {
    const refreshToken = await seedRefreshToken();
    platformPost.mockRejectedValueOnce(rejectedRefresh("Refresh token has expired."));

    const first = await postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
    expect({ status: first.status, error: first.body.error }).toEqual({ status: 400, error: "invalid_grant" });
    expect(first.body.error_description).not.toContain("expired");

    const retry = await postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
    expect({ status: retry.status, error: retry.body.error }).toEqual({ status: 400, error: "invalid_grant" });
  });

  it("rejects a refresh the platform refuses without a known reason with 400 invalid_grant, and the grant stays dead", async () => {
    const refreshToken = await seedRefreshToken();
    platformPost.mockRejectedValueOnce(rejectedRefresh("This grant cannot be used."));

    const first = await postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
    expect({ status: first.status, error: first.body.error }).toEqual({ status: 400, error: "invalid_grant" });
    expect(first.body.error_description).not.toContain("cannot be used");

    const retry = await postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
    expect({ status: retry.status, error: retry.body.error }).toEqual({ status: 400, error: "invalid_grant" });
  });

  it("rejects scope escalation on refresh with 400 invalid_scope, without echoing the requested scopes", async () => {
    const refreshToken = await seedRefreshToken();
    const { status, body } = await postToken({ grant_type: "refresh_token", refresh_token: refreshToken, scope: "tasks:read orgs:write" });
    expect({ status, error: body.error }).toEqual({ status: 400, error: "invalid_scope" });
    expect(body.error_description).not.toContain("orgs:write");
  });

  it("logs each rejected refresh with its reason", async () => {
    const otherClientsToken = await seedRefreshToken("some-other-client");
    const ownToken = await seedRefreshToken();
    const events = await captureAuthEvents(async () => {
      await postToken({ grant_type: "refresh_token", refresh_token: "unknown-refresh-token" });
      await postToken({ grant_type: "refresh_token", refresh_token: otherClientsToken });
      await postToken({ grant_type: "refresh_token", refresh_token: ownToken, scope: "tasks:read orgs:write" });
    });
    const rejected = events.filter((e) => e.event === "refresh_token_rejected").map((e) => e.details);
    expect(rejected).toEqual([
      { reason: "unknown_refresh_token" },
      { reason: "client_mismatch", ownerClientId: "some-other-client" },
      { reason: "scope_escalation" },
    ]);
  });

  it("keeps a transient platform outage a retryable 500 server_error without destroying the grant", async () => {
    const refreshToken = await seedRefreshToken();
    platformPost.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const outage = await postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
    expect({ status: outage.status, error: outage.body.error }).toEqual({ status: 500, error: "server_error" });

    platformPost.mockResolvedValueOnce(platformRenewal);
    const retry = await postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
    expect(retry.status).toBe(200);
    expect(retry.body.refresh_token).toEqual(expect.any(String));
  });

  it("keeps the grant when the platform refuses this server's own credentials (HTTP 401): a retryable 500", async () => {
    const refreshToken = await seedRefreshToken();
    platformPost.mockRejectedValueOnce(httpError(401));

    const refused = await postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
    expect({ status: refused.status, error: refused.body.error }).toEqual({ status: 500, error: "server_error" });

    platformPost.mockResolvedValueOnce(platformRenewal);
    const retry = await postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
    expect(retry.status).toBe(200);
  });

  it.each([
    ["refuses this server's client credentials", httpError(401, { error: "invalid_client", error_description: "Invalid client_secret." })],
    ["reports a fault of its own", httpError(500, { error: "server_error", error_description: "The token request could not be completed." })],
    ["reports a client id that does not match", rejectedRefresh("Client ID mismatch.")],
  ])("keeps the grant when the platform %s: a retryable 500", async (_case, error) => {
    const refreshToken = await seedRefreshToken();
    platformPost.mockRejectedValueOnce(error);

    const refused = await postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
    expect({ status: refused.status, error: refused.body.error }).toEqual({ status: 500, error: "server_error" });

    platformPost.mockResolvedValueOnce(platformRenewal);
    const retry = await postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
    expect(retry.status).toBe(200);
  });
});

describe("POST /token — authorization_code grant errors", () => {
  it("rejects an unknown authorization code with 400 invalid_grant", async () => {
    const { status, body } = await postToken({
      grant_type: "authorization_code",
      code: "unknown-code",
      code_verifier: CODE_VERIFIER,
      redirect_uri: REDIRECT,
    });
    expect({ status, error: body.error }).toEqual({ status: 400, error: "invalid_grant" });
  });

  it("rejects a code issued to another client with 400 invalid_grant, and logs it", async () => {
    const code = await seedAuthCode({ clientId: "some-other-client", platformCode: "platform-code" });
    let response: { status: number; body: Record<string, unknown> } | undefined;
    const events = await captureAuthEvents(async () => {
      response = await postToken({ grant_type: "authorization_code", code, code_verifier: CODE_VERIFIER, redirect_uri: REDIRECT });
    });
    expect({ status: response?.status, error: response?.body.error }).toEqual({ status: 400, error: "invalid_grant" });
    expect(events.filter((e) => e.event === "authorization_code_rejected").map((e) => e.details)).toEqual([
      { reason: "client_mismatch", ownerClientId: "some-other-client" },
    ]);
  });

  it("rejects a redirect_uri that differs from the authorization request with 400 invalid_grant", async () => {
    const code = await seedAuthCode({ platformCode: "platform-code" });
    const { status, body } = await postToken({
      grant_type: "authorization_code",
      code,
      code_verifier: CODE_VERIFIER,
      redirect_uri: "http://localhost:9999/other",
    });
    expect({ status, error: body.error }).toEqual({ status: 400, error: "invalid_grant" });
  });

  it("keeps a platform outage during the code exchange a retryable 500 server_error", async () => {
    const code = await seedAuthCode({ platformCode: "platform-code" });
    platformPost.mockRejectedValueOnce(networkError());
    const { status, body } = await postToken({ grant_type: "authorization_code", code, code_verifier: CODE_VERIFIER, redirect_uri: REDIRECT });
    expect({ status, error: body.error }).toEqual({ status: 500, error: "server_error" });
  });

  it("rejects a code the platform no longer accepts with 400 invalid_grant, and the code stays dead without asking the platform again", async () => {
    const code = await seedAuthCode({ platformCode: "platform-code" });
    platformPost.mockRejectedValueOnce(httpError(400, { error: "invalid_grant", error_description: "Authorization code has already been used." }));

    const first = await postToken({ grant_type: "authorization_code", code, code_verifier: CODE_VERIFIER, redirect_uri: REDIRECT });
    expect({ status: first.status, error: first.body.error }).toEqual({ status: 400, error: "invalid_grant" });
    expect(first.body.error_description).not.toContain("already");

    const retry = await postToken({ grant_type: "authorization_code", code, code_verifier: CODE_VERIFIER, redirect_uri: REDIRECT });
    expect({ status: retry.status, error: retry.body.error }).toEqual({ status: 400, error: "invalid_grant" });
    expect(platformPost).toHaveBeenCalledTimes(1);
  });

  it("keeps the code when the platform refuses this server's client credentials: a retryable 500", async () => {
    const code = await seedAuthCode({ platformCode: "platform-code" });
    platformPost.mockRejectedValueOnce(httpError(401, { error: "invalid_client", error_description: "Invalid client_secret." }));

    const refused = await postToken({ grant_type: "authorization_code", code, code_verifier: CODE_VERIFIER, redirect_uri: REDIRECT });
    expect({ status: refused.status, error: refused.body.error }).toEqual({ status: 500, error: "server_error" });

    platformPost.mockResolvedValueOnce({ data: { access_token: "platform-token", refresh_token: "platform-refresh-token", expires_in: 3600 } });
    const retry = await postToken({ grant_type: "authorization_code", code, code_verifier: CODE_VERIFIER, redirect_uri: REDIRECT });
    expect(retry.status).toBe(200);
    expect(retry.body.access_token).toEqual(expect.any(String));
  });

  it("rejects a code whose platform login never completed with 400 invalid_grant", async () => {
    const code = await seedAuthCode();
    const { status, body } = await postToken({ grant_type: "authorization_code", code, code_verifier: CODE_VERIFIER, redirect_uri: REDIRECT });
    expect({ status, error: body.error }).toEqual({ status: 400, error: "invalid_grant" });
  });
});

describe("/mcp with an expired access token", () => {
  it("answers 401 with a WWW-Authenticate challenge, and the grant's refresh token still works", async () => {
    const accessToken = crypto.randomBytes(32).toString("base64url");
    const refreshToken = crypto.randomBytes(32).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    await store.setTokenRecord(accessToken, {
      accessToken,
      refreshToken,
      platformToken: "platform-token",
      platformRefreshToken: "platform-refresh-token",
      clientId,
      scopes: ["tasks:read"],
      expiresAt: now - 60,
      createdAt: now - 3600,
    }, 30 * 24 * 3600);
    await store.setRefreshIndex(refreshToken, accessToken, 30 * 24 * 3600);

    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toMatch(/^Bearer [\x20-\x7e]*error="invalid_token"/);

    platformPost.mockResolvedValueOnce(platformRenewal);
    const refreshed = await postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
    expect(refreshed.status).toBe(200);
  });
});
