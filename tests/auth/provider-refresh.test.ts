import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InvalidGrantError, InvalidTokenError, ServerError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { ElnoraOAuthProvider } from "../../src/auth/provider.js";
import { InMemoryTokenStore } from "../../src/auth/in-memory-token-store.js";
import { InMemoryClientsStore } from "../../src/auth/clients-store.js";
import type { ElnoraConfig } from "../../src/types.js";
import { FakePlatform, httpError, networkError, rejectedRefresh } from "../helpers/fake-platform.js";

vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
    isAxiosError: (e: unknown) => e instanceof Error && "isAxiosError" in (e as Record<string, unknown>) && (e as Record<string, unknown>).isAxiosError === true,
  },
}));

import axios from "axios";

/**
 * Refreshing an MCP grant renews the platform token pair it carries, so a session stays usable for as long
 * as the client keeps refreshing, not just for the lifetime of the first platform token.
 */
const config: ElnoraConfig = {
  apiUrl: "https://api.example.com",
  tokenValidationUrl: "https://api.example.com/auth/validate-token",
  port: 3001,
  publicUrl: "https://mcp.example.com",
  loginUrl: "https://platform.example.com/login",
  tokenExchangeUrl: "https://api.example.com/oauth/token",
  platformClientId: "mcp-server",
  platformClientSecret: "platform-client-secret",
  mcpServiceKey: "test-service-key",
  redisUrl: "redis://localhost:6379",
  allowHostedClients: false,
};

const HOUR_MS = 3600 * 1000;

let platform: FakePlatform;
let store: InMemoryTokenStore;
let provider: ElnoraOAuthProvider;

beforeEach(() => {
  vi.clearAllMocks();
  platform = new FakePlatform(config);
  vi.mocked(axios.post).mockImplementation(platform.post as never);
  store = new InMemoryTokenStore();
  provider = new ElnoraOAuthProvider(config, store, new InMemoryClientsStore());
});

afterEach(() => {
  vi.useRealTimers();
});

/** Run authorize → platform callback → code exchange, as a client signing in. */
async function signIn() {
  const registered = await provider.clientsStore.registerClient!({ redirect_uris: ["http://localhost:3000/callback"] });
  const client = { client_id: registered.client_id, redirect_uris: ["http://localhost:3000/callback"] };
  const redirect = vi.fn();
  const cookie = vi.fn();
  await provider.authorize(
    client,
    { codeChallenge: "challenge", redirectUri: "http://localhost:3000/callback", scopes: ["tasks:read"] },
    { redirect, cookie, clearCookie: vi.fn() } as never,
  );
  const login = new URL(redirect.mock.calls[0][0]);
  const mcpCode = login.searchParams.get("mcp_code")!;
  await provider.handlePlatformCallback(mcpCode, "platform-code", login.searchParams.get("state")!, cookie.mock.calls[0][1]);
  const tokens = await provider.exchangeAuthorizationCode(client, mcpCode, undefined, "http://localhost:3000/callback");
  return { client, tokens };
}

/** Move the clock forward, as if the client came back later. */
function later(ms: number) {
  vi.useFakeTimers({ now: Date.now() + ms, toFake: ["Date"] });
}

async function grantExists(accessToken: string, refreshToken: string): Promise<boolean> {
  return (await store.getTokenRecord(accessToken)) !== undefined && (await store.getRefreshIndex(refreshToken)) === accessToken;
}

describe("refresh renews the platform token pair", () => {
  it("succeeds long after the platform access token expired, using the stored platform refresh token", async () => {
    const { client, tokens } = await signIn();
    platform.expireAccessTokens();
    later(59 * HOUR_MS);

    const renewed = await provider.exchangeRefreshToken(client, tokens.refresh_token!);

    const refreshCalls = vi.mocked(axios.post).mock.calls.filter(([, body]) => (body as Record<string, unknown>).grant_type === "refresh_token");
    expect(refreshCalls).toEqual([
      [
        config.tokenExchangeUrl,
        { grant_type: "refresh_token", refresh_token: "platform-refresh-1", client_id: "mcp-server", client_secret: "platform-client-secret" },
        expect.objectContaining({ maxRedirects: 0 }),
      ],
    ]);
    expect(platform.calls.map((c) => c.url)).not.toContain(config.tokenValidationUrl);
    expect(await provider.getPlatformToken(renewed.access_token)).toBe("platform-access-2");
    expect((await store.getTokenRecord(renewed.access_token))?.platformRefreshToken).toBe("platform-refresh-2");
  });

  it("presents the platform refresh token from the previous renewal each time", async () => {
    const { client, tokens } = await signIn();
    let current = tokens;
    for (let i = 0; i < 3; i++) {
      later((i + 1) * 2 * HOUR_MS);
      current = await provider.exchangeRefreshToken(client, current.refresh_token!);
    }
    expect(platform.presentedRefreshTokens()).toEqual(["platform-refresh-1", "platform-refresh-2", "platform-refresh-3"]);
    expect(await provider.getPlatformToken(current.access_token)).toBe("platform-access-4");
  });

  it("retires the old MCP grant", async () => {
    const { client, tokens } = await signIn();
    await provider.exchangeRefreshToken(client, tokens.refresh_token!);

    expect(await store.getRefreshIndex(tokens.refresh_token!)).toBeUndefined();
    expect(await store.getTokenRecord(tokens.access_token)).toBeUndefined();
    await expect(provider.exchangeRefreshToken(client, tokens.refresh_token!)).rejects.toBeInstanceOf(InvalidGrantError);
  });

  it("keeps the grant's resource when the client omits it on refresh", async () => {
    const { client, tokens } = await signIn();
    const record = (await store.getTokenRecord(tokens.access_token))!;
    await store.setTokenRecord(tokens.access_token, { ...record, resource: "https://mcp.example.com/mcp" }, 3600);

    const renewed = await provider.exchangeRefreshToken(client, tokens.refresh_token!);
    expect((await store.getTokenRecord(renewed.access_token))!.resource).toBe("https://mcp.example.com/mcp");
  });

  it("returns the new tokens even when cleaning up the old grant fails", async () => {
    const { client, tokens } = await signIn();
    vi.spyOn(store, "deleteTokenRecord").mockRejectedValueOnce(new Error("store unavailable"));

    const renewed = await provider.exchangeRefreshToken(client, tokens.refresh_token!);
    expect(await store.getRefreshIndex(tokens.refresh_token!)).toBeUndefined();
    await expect(provider.exchangeRefreshToken(client, renewed.refresh_token!)).resolves.toBeDefined();
  });

  it("issues access tokens that expire before the platform token they carry", async () => {
    const { client, tokens } = await signIn();
    const signedInAt = Math.floor(Date.now() / 1000);
    expect(tokens.expires_in).toBeLessThanOrEqual(3600 - 300);
    expect((await store.getTokenRecord(tokens.access_token))!.expiresAt).toBeLessThanOrEqual(signedInAt + 3600 - 300);

    later(2 * HOUR_MS);
    const renewedAt = Math.floor(Date.now() / 1000);
    const renewed = await provider.exchangeRefreshToken(client, tokens.refresh_token!);
    expect(renewed.expires_in).toBeGreaterThan(3600 - 300 - 5);
    expect(renewed.expires_in).toBeLessThanOrEqual(3600 - 300);
    expect((await store.getTokenRecord(renewed.access_token))!.expiresAt).toBeLessThanOrEqual(renewedAt + 3600 - 300);
  });
});

describe("refresh when the platform refuses the platform refresh token", () => {
  it.each([
    "Invalid refresh token.",
    "Refresh token has been revoked.",
    "Refresh token has expired.",
    "Access to this organization has ended.",
  ])(
    "returns invalid_grant and deletes the grant (%s)",
    async (description) => {
      const { client, tokens } = await signIn();
      platform.failNext(rejectedRefresh(description));

      const attempt = provider.exchangeRefreshToken(client, tokens.refresh_token!);
      await expect(attempt).rejects.toBeInstanceOf(InvalidGrantError);
      await expect(attempt).rejects.toThrow("Refresh token is no longer valid");
      expect(await grantExists(tokens.access_token, tokens.refresh_token!)).toBe(false);
    },
  );

  it("returns invalid_grant once the platform has ended the session", async () => {
    const { client, tokens } = await signIn();
    platform.endSessions();
    await expect(provider.exchangeRefreshToken(client, tokens.refresh_token!)).rejects.toBeInstanceOf(InvalidGrantError);
    await expect(provider.exchangeRefreshToken(client, tokens.refresh_token!)).rejects.toBeInstanceOf(InvalidGrantError);
  });

  it("returns invalid_grant for a grant that holds no platform refresh token", async () => {
    const { client, tokens } = await signIn();
    const record = (await store.getTokenRecord(tokens.access_token))!;
    await store.setTokenRecord(tokens.access_token, { ...record, platformRefreshToken: undefined }, 3600);

    await expect(provider.exchangeRefreshToken(client, tokens.refresh_token!)).rejects.toBeInstanceOf(InvalidGrantError);
    expect(await grantExists(tokens.access_token, tokens.refresh_token!)).toBe(false);
  });
});

describe("refresh of a grant that is gone", () => {
  it("returns invalid_grant when the grant is revoked while the platform refuses the renewal", async () => {
    const { client, tokens } = await signIn();
    platform.intercept(async () => {
      await provider.revokeToken(client, { token: tokens.access_token });
      throw rejectedRefresh("Refresh token has been revoked.");
    });
    await expect(provider.exchangeRefreshToken(client, tokens.refresh_token!)).rejects.toBeInstanceOf(InvalidGrantError);
  });

  it("returns invalid_grant for a refresh token whose grant record is missing", async () => {
    const { client } = await signIn();
    await store.setRefreshIndex("dangling-refresh-token", "missing-access-token", 3600);
    await expect(provider.exchangeRefreshToken(client, "dangling-refresh-token")).rejects.toBeInstanceOf(InvalidGrantError);
  });
});

describe("refresh when the platform cannot renew right now", () => {
  it.each([
    ["a connection failure", networkError()],
    ["a timeout", networkError("ECONNABORTED")],
    ["a server error", httpError(503)],
    ["rate limiting", httpError(429)],
    ["refused server credentials (401)", httpError(401)],
    ["a forbidden response", httpError(403)],
    ["a missing endpoint", httpError(404)],
    ["a redirect", httpError(307)],
    ["a 400 without an OAuth error", httpError(400, { title: "Bad Request", status: 400 })],
    ["an unsupported grant type", httpError(400, { error: "unsupported_grant_type" })],
    ["refused client credentials", rejectedRefresh("Invalid client_secret.")],
    ["a client id that does not match", rejectedRefresh("Client ID mismatch.")],
    ["a platform fault reported as invalid_grant", rejectedRefresh("The platform could not complete the request.")],
    ["a description that matches an object property", rejectedRefresh("constructor")],
    ["a known description without the trailing period", rejectedRefresh("Invalid refresh token")],
    ["a known description on a 401", httpError(401, { error: "invalid_grant", error_description: "Invalid refresh token." })],
    ["a known description with another error code", httpError(400, { error: "invalid_request", error_description: "Invalid refresh token." })],
    ["a missing signing key reported as invalid_grant", rejectedRefresh("JWT key not configured.")],
  ])("returns a retryable server error and keeps the grant on %s", async (_case, error) => {
    const { client, tokens } = await signIn();
    platform.failNext(error);

    await expect(provider.exchangeRefreshToken(client, tokens.refresh_token!)).rejects.toBeInstanceOf(ServerError);
    expect(await grantExists(tokens.access_token, tokens.refresh_token!)).toBe(true);

    const retried = await provider.exchangeRefreshToken(client, tokens.refresh_token!);
    expect(await provider.getPlatformToken(retried.access_token)).toBe("platform-access-2");
  });

  it.each([
    ["no access token", { refresh_token: "r", expires_in: 3600 }],
    ["an empty access token", { access_token: "", refresh_token: "r", expires_in: 3600 }],
  ])("returns a retryable server error when the platform answers with %s", async (_case, data) => {
    const { client, tokens } = await signIn();
    platform.intercept(async () => ({ data }));

    await expect(provider.exchangeRefreshToken(client, tokens.refresh_token!)).rejects.toBeInstanceOf(ServerError);
    expect(await grantExists(tokens.access_token, tokens.refresh_token!)).toBe(true);
  });

  it("keeps the renewed platform tokens when storing the new grant fails, so a retry succeeds", async () => {
    const { client, tokens } = await signIn();
    const setRefreshIndex = store.setRefreshIndex.bind(store);
    vi.spyOn(store, "setRefreshIndex").mockImplementationOnce(async () => {
      throw new Error("store unavailable");
    }).mockImplementation(setRefreshIndex);

    await expect(provider.exchangeRefreshToken(client, tokens.refresh_token!)).rejects.toThrow("store unavailable");
    const kept = (await store.getTokenRecord(tokens.access_token))!;
    expect([kept.platformToken, kept.platformRefreshToken]).toEqual(["platform-access-2", "platform-refresh-2"]);
    later(5 * 60 * 1000);
    const retried = await provider.exchangeRefreshToken(client, tokens.refresh_token!);

    expect(platform.presentedRefreshTokens()).toEqual(["platform-refresh-1", "platform-refresh-2"]);
    expect(await provider.getPlatformToken(retried.access_token)).toBe("platform-access-3");
  });

  it("cannot recover a renewal whose response was lost after the platform completed it", async () => {
    const { client, tokens } = await signIn();
    platform.intercept(async (proceed) => {
      await proceed();
      throw networkError("ECONNABORTED");
    });

    await expect(provider.exchangeRefreshToken(client, tokens.refresh_token!)).rejects.toBeInstanceOf(ServerError);
    await expect(provider.exchangeRefreshToken(client, tokens.refresh_token!)).rejects.toBeInstanceOf(InvalidGrantError);
  });

  it("stores no platform refresh token when the platform returns none, so the next refresh asks to sign in", async () => {
    const { client, tokens } = await signIn();
    platform.intercept(async () => ({ data: { access_token: "platform-access-x", expires_in: 3600 } }));

    const renewed = await provider.exchangeRefreshToken(client, tokens.refresh_token!);
    expect(await provider.getPlatformToken(renewed.access_token)).toBe("platform-access-x");
    await expect(provider.exchangeRefreshToken(client, renewed.refresh_token!)).rejects.toBeInstanceOf(InvalidGrantError);
  });
});

describe("concurrent use of one grant", () => {
  it("lets one of two simultaneous refreshes win, and the winner's grant keeps working", async () => {
    const { client, tokens } = await signIn();

    const results = await Promise.allSettled([
      provider.exchangeRefreshToken(client, tokens.refresh_token!),
      provider.exchangeRefreshToken(client, tokens.refresh_token!),
    ]);

    const winners = results.filter((r) => r.status === "fulfilled");
    expect(winners).toHaveLength(1);
    const winner = (winners[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof provider.exchangeRefreshToken>>>).value;
    await expect(provider.exchangeRefreshToken(client, winner.refresh_token!)).resolves.toBeDefined();
  });

  it("keeps the session when parallel requests all find the platform token expired", async () => {
    const { client, tokens } = await signIn();
    platform.expireAccessTokens();

    const results = await Promise.allSettled([1, 2, 3].map(() => provider.verifyAccessToken(tokens.access_token)));

    expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled", "fulfilled"]);
    expect(await grantExists(tokens.access_token, tokens.refresh_token!)).toBe(true);
    await expect(provider.exchangeRefreshToken(client, tokens.refresh_token!)).resolves.toBeDefined();
  });

  it("does not delete a grant that a request on the /mcp path renewed while a refresh was in flight", async () => {
    const { client, tokens } = await signIn();
    platform.expireAccessTokens();
    // While the refresh's platform call is in flight, a tool call renews the same grant in place and so
    // consumes the platform refresh token the refresh is presenting.
    platform.intercept(async (proceed) => {
      await provider.verifyAccessToken(tokens.access_token);
      return proceed();
    });

    await expect(provider.exchangeRefreshToken(client, tokens.refresh_token!)).rejects.toBeInstanceOf(ServerError);
    expect(await grantExists(tokens.access_token, tokens.refresh_token!)).toBe(true);
    await expect(provider.exchangeRefreshToken(client, tokens.refresh_token!)).resolves.toBeDefined();
  });

  it("presents the platform refresh token once when parallel requests renew the same grant", async () => {
    const { tokens } = await signIn();
    platform.expireAccessTokens();
    await Promise.all([1, 2, 3].map(() => provider.verifyAccessToken(tokens.access_token)));
    expect(platform.presentedRefreshTokens()).toEqual(["platform-refresh-1"]);
  });

  it("does not keep a failed in-place renewal for later requests", async () => {
    const { tokens } = await signIn();
    platform.expireAccessTokens();
    platform.intercept((proceed) => proceed()); // validation answers normally
    platform.failNext(httpError(503)); // renewal fails
    await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toBeInstanceOf(ServerError);
    await expect(provider.verifyAccessToken(tokens.access_token)).resolves.toMatchObject({ token: tokens.access_token });
  });

  it("keeps parallel renewals of different grants of one client apart", async () => {
    const first = await signIn();
    const second = await signIn();
    const record = (await store.getTokenRecord(second.tokens.access_token))!;
    await store.setTokenRecord(second.tokens.access_token, { ...record, clientId: first.client.client_id }, 3600);
    platform.expireAccessTokens();

    const [a, b] = await Promise.all([
      provider.verifyAccessToken(first.tokens.access_token),
      provider.verifyAccessToken(second.tokens.access_token),
    ]);
    expect([a.token, b.token]).toEqual([first.tokens.access_token, second.tokens.access_token]);
    expect(await provider.getPlatformToken(first.tokens.access_token)).not.toBe(await provider.getPlatformToken(second.tokens.access_token));
  });

  it("keeps the session when a request acts on a validation answer that a parallel renewal made stale", async () => {
    const { tokens } = await signIn();
    platform.expireAccessTokens();
    // While this request's validation is in flight, another request validates and renews completely.
    platform.intercept(async (proceed) => {
      const response = await proceed();
      await provider.verifyAccessToken(tokens.access_token);
      return response;
    });

    await expect(provider.verifyAccessToken(tokens.access_token)).resolves.toMatchObject({ token: tokens.access_token });
    expect(await grantExists(tokens.access_token, tokens.refresh_token!)).toBe(true);
  });

  it("makes a refresh wait for an in-place renewal of the same grant instead of failing", async () => {
    const { client, tokens } = await signIn();
    platform.expireAccessTokens();
    let refresh: Promise<unknown> | undefined;
    platform.intercept((proceed) => proceed()); // validation
    platform.intercept(async (proceed) => {
      refresh = provider.exchangeRefreshToken(client, tokens.refresh_token!); // starts while the renewal is in flight
      return proceed();
    });

    await provider.verifyAccessToken(tokens.access_token);
    await expect(refresh).resolves.toBeDefined();
    expect(platform.presentedRefreshTokens()).toEqual(["platform-refresh-1", "platform-refresh-2"]);
  });

  it("keeps the grant when another server instance renewed it with the same token", async () => {
    const { tokens } = await signIn();
    const otherInstance = new ElnoraOAuthProvider(config, store, new InMemoryClientsStore());
    platform.expireAccessTokens();
    let otherRequest: Promise<unknown> | undefined;
    platform.intercept((proceed) => proceed()); // this instance validates
    platform.intercept(async (proceed) => {
      // The platform renews for this instance, but before this instance stores the result, the other
      // instance presents the same token and is told it was already used.
      const response = await proceed();
      let seenRejection!: () => void;
      const rejectionSeen = new Promise<void>((resolve) => (seenRejection = resolve));
      platform.intercept((p) => p()); // the other instance validates
      platform.intercept(async (p) => {
        try {
          return await p();
        } finally {
          seenRejection();
        }
      });
      otherRequest = otherInstance.verifyAccessToken(tokens.access_token);
      await rejectionSeen;
      return response;
    });

    await expect(provider.verifyAccessToken(tokens.access_token)).resolves.toMatchObject({ token: tokens.access_token });
    await expect(otherRequest).resolves.toMatchObject({ token: tokens.access_token });
    expect(await grantExists(tokens.access_token, tokens.refresh_token!)).toBe(true);
  });
});

describe("in-place renewal on the /mcp path", () => {
  it("renews the platform token when it is reported invalid", async () => {
    const { tokens } = await signIn();
    platform.expireAccessTokens();

    await expect(provider.verifyAccessToken(tokens.access_token)).resolves.toMatchObject({ token: tokens.access_token });
    expect(await provider.getPlatformToken(tokens.access_token)).toBe("platform-access-2");
    expect((await store.getTokenRecord(tokens.access_token))?.platformRefreshToken).toBe("platform-refresh-2");
  });

  it("revokes the grant when the platform refuses the platform refresh token", async () => {
    const { tokens } = await signIn();
    platform.expireAccessTokens();
    platform.endSessions();

    await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toBeInstanceOf(InvalidTokenError);
    expect(await grantExists(tokens.access_token, tokens.refresh_token!)).toBe(false);
  });

  it("revokes the grant when the user no longer has access to the organization", async () => {
    const { tokens } = await signIn();
    platform.expireAccessTokens();
    platform.intercept((proceed) => proceed()); // validation answers normally
    platform.failNext(rejectedRefresh("Access to this organization has ended."));

    await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toBeInstanceOf(InvalidTokenError);
    expect(await grantExists(tokens.access_token, tokens.refresh_token!)).toBe(false);
  });

  it("fails with a server error and keeps the grant when renewal is unavailable", async () => {
    const { tokens } = await signIn();
    platform.expireAccessTokens();
    platform.intercept((proceed) => proceed()); // validation answers normally
    platform.failNext(httpError(503)); // renewal fails

    await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toBeInstanceOf(ServerError);
    expect(await grantExists(tokens.access_token, tokens.refresh_token!)).toBe(true);
  });

  it("leaves the access token's expiry unchanged", async () => {
    const { tokens } = await signIn();
    const before = (await store.getTokenRecord(tokens.access_token))!.expiresAt;
    platform.expireAccessTokens();
    later(30 * 60 * 1000);

    await provider.verifyAccessToken(tokens.access_token);
    expect((await store.getTokenRecord(tokens.access_token))!.expiresAt).toBe(before);
  });

  it("revokes a grant that holds no platform refresh token", async () => {
    const { tokens } = await signIn();
    const record = (await store.getTokenRecord(tokens.access_token))!;
    await store.setTokenRecord(tokens.access_token, { ...record, platformRefreshToken: undefined }, 3600);
    platform.expireAccessTokens();

    await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toBeInstanceOf(InvalidTokenError);
    expect(await grantExists(tokens.access_token, tokens.refresh_token!)).toBe(false);
  });

  it("does not trust a validation answer without a verdict", async () => {
    const { tokens } = await signIn();
    platform.intercept(async () => ({ data: {} }));

    await provider.verifyAccessToken(tokens.access_token).catch(() => undefined);
    expect(platform.presentedRefreshTokens()).toEqual(["platform-refresh-1"]);
  });

  it("answers 401 when a refresh retired the grant while the renewal was in flight", async () => {
    const { client, tokens } = await signIn();
    platform.expireAccessTokens();
    let refresh: Promise<unknown> | undefined;
    // The refresh is already presenting the platform refresh token when the tool call's renewal starts.
    platform.intercept(async (proceed) => {
      const response = await proceed();
      let seenRejection!: () => void;
      const rejectionSeen = new Promise<void>((resolve) => (seenRejection = resolve));
      platform.intercept((p) => p()); // the tool call validates
      platform.intercept(async (p) => {
        try {
          return await p();
        } finally {
          seenRejection();
        }
      });
      toolCall = provider.verifyAccessToken(tokens.access_token);
      await rejectionSeen;
      return response;
    });
    let toolCall: Promise<unknown> | undefined;
    refresh = provider.exchangeRefreshToken(client, tokens.refresh_token!);

    await expect(refresh).resolves.toBeDefined();
    await expect(toolCall).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("fails with a server error without renewing when validation refuses this server's credentials", async () => {
    const { tokens } = await signIn();
    platform.failNext(httpError(401));

    await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toBeInstanceOf(ServerError);
    expect(platform.presentedRefreshTokens()).toEqual([]);
    expect(await grantExists(tokens.access_token, tokens.refresh_token!)).toBe(true);
  });
});

describe("expired MCP access tokens", () => {
  it("are refused, but the grant's refresh token keeps working", async () => {
    const { client, tokens } = await signIn();
    later(2 * HOUR_MS);

    await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toThrow("Access token expired");
    await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toThrow("Access token expired");
    await expect(provider.exchangeRefreshToken(client, tokens.refresh_token!)).resolves.toBeDefined();
  });

  it("can still be revoked", async () => {
    const { client, tokens } = await signIn();
    later(2 * HOUR_MS);
    await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toThrow("Access token expired");

    await provider.revokeToken(client, { token: tokens.access_token });
    expect(await grantExists(tokens.access_token, tokens.refresh_token!)).toBe(false);
  });
});

describe("auth event logging", () => {
  async function authEvents(fn: () => Promise<unknown>): Promise<Array<{ event: string; details?: Record<string, unknown> }>> {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await fn();
      return errorLog.mock.calls.map(([line]) => JSON.parse(String(line))).filter((entry) => entry.type === "auth_event");
    } finally {
      errorLog.mockRestore();
    }
  }

  it("records why a renewal failed and on which path", async () => {
    const { client, tokens } = await signIn();
    const events = await authEvents(async () => {
      platform.failNext(httpError(429));
      await provider.exchangeRefreshToken(client, tokens.refresh_token!).catch(() => undefined);
      platform.failNext(rejectedRefresh("x".repeat(300)));
      await provider.exchangeRefreshToken(client, tokens.refresh_token!).catch(() => undefined);
      platform.failNext(rejectedRefresh("Refresh token has expired."));
      await provider.exchangeRefreshToken(client, tokens.refresh_token!).catch(() => undefined);
    });
    const ended = await signIn();
    const accessEndedEvents = await authEvents(async () => {
      platform.failNext(rejectedRefresh("Access to this organization has ended."));
      await provider.exchangeRefreshToken(ended.client, ended.tokens.refresh_token!).catch(() => undefined);
    });

    expect(events.filter((e) => e.event.startsWith("platform_") || e.event.startsWith("refresh_platform")).map((e) => [e.event, e.details])).toEqual([
      ["platform_token_refresh_failed", { path: "refresh", outcome: "unavailable", reason: "rate_limited", status: 429 }],
      ["platform_token_refresh_failed", { path: "refresh", outcome: "unavailable", reason: "http_error", status: 400, platformError: "x".repeat(100) }],
      ["platform_token_refresh_failed", { path: "refresh", outcome: "rejected", reason: "expired" }],
      ["refresh_platform_token_revoked", { path: "refresh", reason: "expired" }],
    ]);
    expect(accessEndedEvents.filter((e) => e.event === "refresh_platform_token_revoked").map((e) => e.details)).toEqual([
      { path: "refresh", reason: "access_ended" },
    ]);
  });

  it("records in-place renewals", async () => {
    const { tokens } = await signIn();
    platform.expireAccessTokens();
    const events = await authEvents(() => provider.verifyAccessToken(tokens.access_token));
    expect(events.map((e) => e.event)).toContain("platform_token_refreshed");
  });

  it("never writes token values or the client secret", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, tokens } = await signIn();
    const renewed = await provider.exchangeRefreshToken(client, tokens.refresh_token!);
    platform.failNext(httpError(503));
    await provider.exchangeRefreshToken(client, renewed.refresh_token!).catch(() => undefined);
    platform.failNext(rejectedRefresh("Refresh token has been revoked."));
    await provider.exchangeRefreshToken(client, renewed.refresh_token!).catch(() => undefined);

    const logged = errorLog.mock.calls.map((args) => args.join(" ")).join("\n");
    errorLog.mockRestore();
    for (const secret of [
      tokens.access_token,
      tokens.refresh_token!,
      renewed.access_token,
      renewed.refresh_token!,
      "platform-access-1",
      "platform-refresh-1",
      "platform-access-2",
      "platform-refresh-2",
      config.platformClientSecret,
    ]) {
      expect(logged).not.toContain(secret);
    }
    expect(logged).toContain("platform_token_refresh_failed");
    expect(logged).toContain("refresh_platform_token_revoked");
  });
});
