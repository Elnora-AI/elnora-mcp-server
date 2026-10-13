import { describe, it, expect, vi, beforeEach } from "vitest";
import { ElnoraOAuthProvider } from "../../src/auth/provider.js";
import { InMemoryTokenStore } from "../../src/auth/in-memory-token-store.js";
import { InMemoryClientsStore } from "../../src/auth/clients-store.js";
import type { ElnoraConfig } from "../../src/types.js";

vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
    isAxiosError: (e: unknown) =>
      e instanceof Error && "isAxiosError" in (e as Record<string, unknown>) && (e as Record<string, unknown>).isAxiosError === true,
  },
}));

const baseConfig: Omit<ElnoraConfig, "allowHostedClients"> = {
  apiUrl: "https://api.example.com",
  tokenValidationUrl: "https://api.example.com/auth/validate-token",
  port: 3001,
  publicUrl: "https://mcp.example.com",
  loginUrl: "https://platform.example.com/login",
  tokenExchangeUrl: "https://api.example.com/oauth/token",
  platformClientId: "mcp-server",
  platformClientSecret: "secret",
  mcpServiceKey: "test-service-key",
  redisUrl: "redis://localhost:6379",
};
const hostedConfig: ElnoraConfig = { ...baseConfig, allowHostedClients: true };
const lockedConfig: ElnoraConfig = { ...baseConfig, allowHostedClients: false };

const HOSTED_REDIRECT = "https://claude.ai/api/mcp/auth_callback";

/** A fake Express response that captures the consent-render path (cookie / CSP header / HTML body). */
function makeConsentRes() {
  const calls: {
    redirect?: string;
    cookie?: { name: string; value: string };
    html?: string;
    status?: number;
    headers: Record<string, string>;
  } = { headers: {} };
  const res = {
    redirect: (url: string) => { calls.redirect = url; },
    cookie: (name: string, value: string) => { calls.cookie = { name, value }; },
    clearCookie: () => {},
    setHeader: (k: string, v: string) => { calls.headers[k] = v; },
    status: (s: number) => { calls.status = s; return res; },
    type: () => res,
    send: (body: string) => { calls.html = body; },
  };
  return { res: res as never, calls };
}

function extractMcpCode(html: string): string {
  const m = html.match(/name="mcp_code" value="([^"]+)"/);
  if (!m) throw new Error("mcp_code not found in consent HTML");
  return m[1];
}

async function registerHostedClient(clientsStore: InMemoryClientsStore) {
  const registered = await clientsStore.registerClient!({ redirect_uris: [HOSTED_REDIRECT] });
  return { client_id: registered.client_id, redirect_uris: [HOSTED_REDIRECT] };
}

describe("hosted-client consent flow", () => {
  let store: InMemoryTokenStore;
  let clientsStore: InMemoryClientsStore;
  let provider: ElnoraOAuthProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new InMemoryTokenStore();
    clientsStore = new InMemoryClientsStore(true); // hosted registration allowed
    provider = new ElnoraOAuthProvider(hostedConfig, store, clientsStore);
  });

  describe("authorize (non-loopback)", () => {
    it("renders the consent page instead of redirecting, and stores an unconsented session", async () => {
      const client = await registerHostedClient(clientsStore);
      const { res, calls } = makeConsentRes();

      await provider.authorize(client, { codeChallenge: "c", redirectUri: HOSTED_REDIRECT, scopes: ["tasks:read"], state: "s" } as never, res);

      expect(calls.redirect).toBeUndefined();
      expect(calls.html).toContain("claude.ai");
      expect(calls.headers["Content-Security-Policy"]).toContain("default-src 'none'");
      expect(calls.cookie?.value).toBeTruthy();

      const mcpCode = extractMcpCode(calls.html!);
      const session = await store.getSession(mcpCode);
      expect(session?.consented).toBe(false);
      expect(session?.scopes).toEqual(["tasks:read"]);
    });

    it("downscopes a hosted client to read-only (write scopes are dropped)", async () => {
      const client = await registerHostedClient(clientsStore);
      const { res, calls } = makeConsentRes();

      await provider.authorize(client, { codeChallenge: "c", redirectUri: HOSTED_REDIRECT, scopes: ["tasks:read", "tasks:write", "api-keys:write"] } as never, res);

      const session = await store.getSession(extractMcpCode(calls.html!));
      expect(session?.scopes).toEqual(["tasks:read"]);
      expect(calls.html).not.toContain("Write access");
    });

    it("drops security-sensitive reads (api-keys:read, audit:read) from a hosted grant", async () => {
      const client = await registerHostedClient(clientsStore);
      const { res, calls } = makeConsentRes();
      await provider.authorize(client, { codeChallenge: "c", redirectUri: HOSTED_REDIRECT, scopes: ["tasks:read", "api-keys:read", "audit:read"] } as never, res);
      const session = await store.getSession(extractMcpCode(calls.html!));
      expect(session?.scopes).toEqual(["tasks:read"]);
    });

    it("rejects a hosted client that requests only write/unavailable scopes", async () => {
      const client = await registerHostedClient(clientsStore);
      const { res } = makeConsentRes();
      await expect(
        provider.authorize(client, { codeChallenge: "c", redirectUri: HOSTED_REDIRECT, scopes: ["tasks:write"] } as never, res),
      ).rejects.toThrow("None of the requested scopes are available to hosted clients");
    });

    it("rejects a non-loopback redirect when hosted clients are disabled", async () => {
      const locked = new ElnoraOAuthProvider(lockedConfig, store, clientsStore);
      const client = await registerHostedClient(clientsStore);
      const { res } = makeConsentRes();
      await expect(
        locked.authorize(client, { codeChallenge: "c", redirectUri: HOSTED_REDIRECT, scopes: ["tasks:read"] } as never, res),
      ).rejects.toThrow("must be a loopback address");
    });
  });

  describe("grantConsent", () => {
    async function startFlow() {
      const client = await registerHostedClient(clientsStore);
      const { res, calls } = makeConsentRes();
      await provider.authorize(client, { codeChallenge: "c", redirectUri: HOSTED_REDIRECT, scopes: ["tasks:read"], state: "client-state" } as never, res);
      return { client, mcpCode: extractMcpCode(calls.html!), binding: calls.cookie!.value };
    }

    it("marks the session consented and returns the platform login URL on a valid binding", async () => {
      const { mcpCode, binding } = await startFlow();
      const loginUrl = new URL(await provider.grantConsent(mcpCode, binding));
      expect(loginUrl.origin + loginUrl.pathname).toBe("https://platform.example.com/login");
      expect(loginUrl.searchParams.get("mcp_code")).toBe(mcpCode);
      expect(loginUrl.searchParams.get("client_id")).toBe("mcp-server");
      expect(loginUrl.searchParams.get("redirect_uri")).toBe("https://mcp.example.com/oauth/callback");
      expect((await store.getSession(mcpCode))?.consented).toBe(true);
    });

    it("fails closed when the binding cookie is absent, duplicate, or mismatched", async () => {
      const { mcpCode } = await startFlow();
      await expect(provider.grantConsent(mcpCode, undefined)).rejects.toThrow("could not be verified");
      await expect(provider.grantConsent(mcpCode, null)).rejects.toThrow("could not be verified");
      await expect(provider.grantConsent(mcpCode, "wrong-binding")).rejects.toThrow("could not be verified");
    });

    it("rejects an unknown/expired session", async () => {
      await expect(provider.grantConsent("nope", "x")).rejects.toThrow("Invalid or expired authorization session");
    });

    it("rejects a replay once the callback has bound a platform code", async () => {
      const { mcpCode, binding } = await startFlow();
      await store.updateSession(mcpCode, { platformCode: "already" });
      await expect(provider.grantConsent(mcpCode, binding)).rejects.toThrow("already processed");
    });
  });

  describe("denyConsent", () => {
    it("returns an access_denied redirect to the registered URI and consumes the session", async () => {
      const client = await registerHostedClient(clientsStore);
      const { res, calls } = makeConsentRes();
      await provider.authorize(client, { codeChallenge: "c", redirectUri: HOSTED_REDIRECT, scopes: ["tasks:read"], state: "client-state" } as never, res);
      const mcpCode = extractMcpCode(calls.html!);
      const binding = calls.cookie!.value;

      const redirect = new URL(await provider.denyConsent(mcpCode, binding));
      expect(redirect.origin + redirect.pathname).toBe("https://claude.ai/api/mcp/auth_callback");
      expect(redirect.searchParams.get("error")).toBe("access_denied");
      expect(redirect.searchParams.get("state")).toBe("client-state");
      expect(await store.getSession(mcpCode)).toBeUndefined();
    });

    it("fails closed without the binding cookie", async () => {
      const client = await registerHostedClient(clientsStore);
      const { res, calls } = makeConsentRes();
      await provider.authorize(client, { codeChallenge: "c", redirectUri: HOSTED_REDIRECT, scopes: ["tasks:read"] } as never, res);
      await expect(provider.denyConsent(extractMcpCode(calls.html!), undefined)).rejects.toThrow("could not be verified");
    });
  });

  describe("handlePlatformCallback (non-loopback)", () => {
    it("delivers the code to the hosted redirect only after consent (flag on)", async () => {
      const client = await registerHostedClient(clientsStore);
      const { res, calls } = makeConsentRes();
      await provider.authorize(client, { codeChallenge: "c", redirectUri: HOSTED_REDIRECT, scopes: ["tasks:read"], state: "client-state" } as never, res);
      const mcpCode = extractMcpCode(calls.html!);
      const binding = calls.cookie!.value;

      // Simulate the user approving, then completing platform login in the same browser.
      const loginUrl = new URL(await provider.grantConsent(mcpCode, binding));
      const platformState = loginUrl.searchParams.get("state")!;

      const redirect = new URL(await provider.handlePlatformCallback(mcpCode, "platform-code", platformState, binding));
      expect(redirect.origin + redirect.pathname).toBe("https://claude.ai/api/mcp/auth_callback");
      expect(redirect.searchParams.get("code")).toBe(mcpCode);
      expect(redirect.searchParams.get("state")).toBe("client-state");
    });

    it("refuses delivery to a non-loopback redirect that was never consented (defense-in-depth)", async () => {
      const client = await registerHostedClient(clientsStore);
      await store.setSession("manual", {
        clientId: client.client_id,
        codeChallenge: "c",
        redirectUri: HOSTED_REDIRECT,
        scopes: ["tasks:read"],
        state: "s",
        platformState: "ps",
        browserBinding: "b",
        consented: false,
        createdAt: Date.now(),
      }, 600);
      await expect(provider.handlePlatformCallback("manual", "platform-code", "ps", "b")).rejects.toThrow("Redirect URI not permitted");
    });

    it("refuses a consented non-loopback session once the flag is turned off", async () => {
      const client = await registerHostedClient(clientsStore);
      await store.setSession("manual2", {
        clientId: client.client_id,
        codeChallenge: "c",
        redirectUri: HOSTED_REDIRECT,
        scopes: ["tasks:read"],
        state: "s",
        platformState: "ps",
        browserBinding: "b",
        consented: true,
        createdAt: Date.now(),
      }, 600);
      const locked = new ElnoraOAuthProvider(lockedConfig, store, clientsStore);
      await expect(locked.handlePlatformCallback("manual2", "platform-code", "ps", "b")).rejects.toThrow("Redirect URI not permitted");
    });

    it("keeps a code bound to the client it was approved for (no A/B cross-delivery)", async () => {
      const clientA = await registerHostedClient(clientsStore);
      const { res, calls } = makeConsentRes();
      await provider.authorize(clientA, { codeChallenge: "c", redirectUri: HOSTED_REDIRECT, scopes: ["tasks:read"] } as never, res);
      const mcpCode = extractMcpCode(calls.html!);

      // A different client cannot exchange A's code.
      const clientB = { client_id: "client-B", redirect_uris: ["https://evil.example.com/cb"] };
      await expect(provider.exchangeAuthorizationCode(clientB, mcpCode)).rejects.toThrow("was not issued to this client");
    });
  });

  describe("loopback clients are unaffected", () => {
    it("redirects straight to platform login with an auto-consented session (no screen)", async () => {
      const client = { client_id: "cli", redirect_uris: ["http://localhost:4000/cb"] };
      const { res, calls } = makeConsentRes();
      await provider.authorize(client, { codeChallenge: "c", redirectUri: "http://localhost:4000/cb", scopes: ["tasks:read"] } as never, res);

      expect(calls.html).toBeUndefined();
      expect(calls.redirect).toContain("https://platform.example.com/login");
      const mcpCode = new URL(calls.redirect!).searchParams.get("mcp_code")!;
      expect((await store.getSession(mcpCode))?.consented).toBe(true);
    });

    it("delivers to a loopback session even when the consented field is absent (pre-deploy in-flight)", async () => {
      const loopbackStore = new InMemoryClientsStore(false);
      const registered = await loopbackStore.registerClient!({ redirect_uris: ["http://localhost:4000/cb"] });
      const p = new ElnoraOAuthProvider(hostedConfig, store, loopbackStore);
      await store.setSession("legacy", {
        clientId: registered.client_id,
        codeChallenge: "c",
        redirectUri: "http://localhost:4000/cb",
        scopes: ["tasks:read"],
        state: "s",
        platformState: "ps",
        browserBinding: "b",
        createdAt: Date.now(),
        // note: no `consented` field (session created before this change shipped)
      } as never, 300);

      const redirect = new URL(await p.handlePlatformCallback("legacy", "platform-code", "ps", "b"));
      expect(redirect.origin + redirect.pathname).toBe("http://localhost:4000/cb");
      expect(redirect.searchParams.get("code")).toBe("legacy");
    });
  });
});
