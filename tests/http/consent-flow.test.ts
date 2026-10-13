import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "../../src/app.js";
import { InMemoryTokenStore } from "../../src/auth/in-memory-token-store.js";
import { InMemoryClientsStore } from "../../src/auth/clients-store.js";
import type { ElnoraConfig } from "../../src/types.js";

/**
 * In-action HTTP harness: boots the real Express app (createApp) on an ephemeral port with in-memory
 * stores and drives the consent surface end to end with fetch. No Redis, no network, no new deps.
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
  allowHostedClients: true,
};

const HOSTED = "https://claude.ai/api/mcp/auth_callback";
const LOOPBACK = "http://localhost:9999/cb";
const BINDING_COOKIE = "__Host-mcp_authz_binding";

let server: Server;
let baseUrl: string;
let hostedClientId: string;
let loopbackClientId: string;

beforeAll(async () => {
  const store = new InMemoryTokenStore();
  const clientsStore = new InMemoryClientsStore(true);
  hostedClientId = (await clientsStore.registerClient!({ redirect_uris: [HOSTED], client_name: "Claude Test" })).client_id;
  loopbackClientId = (await clientsStore.registerClient!({ redirect_uris: [LOOPBACK], client_name: "CLI Test" })).client_id;

  const app = createApp(config, store, clientsStore);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function authorizeUrl(clientId: string, redirectUri: string, scope = "tasks:read"): string {
  const u = new URL(`${baseUrl}/authorize`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("code_challenge", "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("scope", scope);
  u.searchParams.set("state", "client-state");
  return u.toString();
}

function readBinding(res: Response): string {
  const setCookies = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""];
  const joined = setCookies.join("; ");
  const m = joined.match(new RegExp(`${BINDING_COOKIE}=([^;]+)`));
  if (!m) throw new Error(`binding cookie not set: ${joined}`);
  return m[1];
}

async function startAuthorize(): Promise<{ mcpCode: string; cookie: string }> {
  const res = await fetch(authorizeUrl(hostedClientId, HOSTED), { redirect: "manual" });
  const binding = readBinding(res);
  const html = await res.text();
  const m = html.match(/name="mcp_code" value="([^"]+)"/);
  if (!m) throw new Error("mcp_code not found in consent HTML");
  return { mcpCode: m[1], cookie: `${BINDING_COOKIE}=${binding}` };
}

async function postConsent(body: Record<string, string>, cookie?: string): Promise<Response> {
  return fetch(`${baseUrl}/oauth/consent`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(cookie ? { cookie } : {}),
    },
    body: new URLSearchParams(body).toString(),
  });
}

describe("GET /authorize (hosted client)", () => {
  it("renders the consent page with the binding cookie and a strict CSP", async () => {
    const res = await fetch(authorizeUrl(hostedClientId, HOSTED), { redirect: "manual" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    const setCookies = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""];
    expect(setCookies.join("; ")).toContain(`${BINDING_COOKIE}=`);
    const html = await res.text();
    expect(html).toContain("claude.ai");
    expect(html).not.toContain("<script");
  });
});

describe("POST /oauth/consent", () => {
  it("allow with the binding cookie redirects to the platform login", async () => {
    const { mcpCode, cookie } = await startAuthorize();
    const res = await postConsent({ decision: "allow", mcp_code: mcpCode }, cookie);
    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    expect(location).toContain("https://platform.example.com/login");
    expect(location).toContain(`mcp_code=${mcpCode}`);
  });

  it("allow WITHOUT the binding cookie fails closed (no redirect to login)", async () => {
    const { mcpCode } = await startAuthorize();
    const res = await postConsent({ decision: "allow", mcp_code: mcpCode });
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("location")).toBeNull();
  });

  it("deny with the binding cookie redirects to the client with access_denied", async () => {
    const { mcpCode, cookie } = await startAuthorize();
    const res = await postConsent({ decision: "deny", mcp_code: mcpCode }, cookie);
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("location")!);
    expect(location.origin + location.pathname).toBe(HOSTED);
    expect(location.searchParams.get("error")).toBe("access_denied");
  });

  it("an invalid decision returns a 400 HTML error", async () => {
    const { mcpCode, cookie } = await startAuthorize();
    const res = await postConsent({ decision: "maybe", mcp_code: mcpCode }, cookie);
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("text/html");
  });
});

describe("GET /authorize (loopback client) — unchanged", () => {
  it("redirects straight to the platform login with no consent screen", async () => {
    const res = await fetch(authorizeUrl(loopbackClientId, LOOPBACK), { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("https://platform.example.com/login");
  });
});
