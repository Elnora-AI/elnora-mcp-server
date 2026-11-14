import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import axios from "axios";
import { createApp } from "../../src/app.js";
import { InMemoryTokenStore } from "../../src/auth/in-memory-token-store.js";
import { InMemoryClientsStore } from "../../src/auth/clients-store.js";
import { ElnoraApiClient } from "../../src/services/elnora-api-client.js";
import { SIGN_IN_UNAVAILABLE_TOOLS, TOOL_SCOPES } from "../../src/tools/scope-guard.js";
import { SUPPORTED_SCOPES } from "../../src/constants.js";
import type { ElnoraConfig } from "../../src/types.js";

/**
 * POST /mcp lists tools per session: a sign-in (OAuth) session leaves out the tools it cannot use, an API-key
 * session lists every tool.
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

let server: Server;
let baseUrl: string;
let store: InMemoryTokenStore;

beforeAll(async () => {
  store = new InMemoryTokenStore();
  const app = createApp(config, store, new InMemoryClientsStore(false));
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// Every call to Elnora must be mocked by the test that expects it.
let platformPost: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  platformPost = vi.spyOn(axios, "post").mockRejectedValue(new Error("unexpected platform call"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** A valid sign-in access token holding every scope the server offers, as an MCP client requests them. */
async function seedSignInToken(): Promise<string> {
  const accessToken = crypto.randomBytes(32).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  await store.setTokenRecord(accessToken, {
    accessToken,
    refreshToken: crypto.randomBytes(32).toString("base64url"),
    platformToken: "platform-token",
    platformRefreshToken: "platform-refresh-token",
    clientId: "sign-in-client",
    scopes: [...SUPPORTED_SCOPES],
    expiresAt: now + 3600,
    createdAt: now,
  }, 3600);
  await store.setValidationCache(accessToken, now, 300);
  return accessToken;
}

async function rpc(headers: Record<string, string>, method: string, params?: unknown): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, ...(params === undefined ? {} : { params }) }),
  });
  return { status: res.status, body: await res.json() };
}

async function listedTools(headers: Record<string, string>): Promise<string[]> {
  const { status, body } = await rpc(headers, "tools/list");
  expect(status).toBe(200);
  return (body.result.tools as Array<{ name: string }>).map((t) => t.name).sort();
}

describe("POST /mcp tools/list", () => {
  it("a sign-in session does not list organization-administration, API-key, audit-log or platform-administration tools", async () => {
    const tools = await listedTools({ Authorization: `Bearer ${await seedSignInToken()}` });

    expect(tools).toEqual(Object.keys(TOOL_SCOPES).filter((t) => !SIGN_IN_UNAVAILABLE_TOOLS.has(t)).sort());
    expect(tools).not.toContain("elnora_audit_list");
    expect(tools).not.toContain("elnora_orgs_acceptInvite");
    expect(tools).toContain("elnora_tasks_list");
    expect(tools).toContain("elnora_orgs_list");
    expect(tools).toContain("elnora_orgs_invitationInfo");
  });

  it("an API-key session lists every tool", async () => {
    platformPost.mockResolvedValueOnce({ data: { valid: true, userId: "42" } });

    const tools = await listedTools({ "X-API-Key": `elnora_live_${crypto.randomBytes(16).toString("hex")}` });

    expect(tools).toEqual(Object.keys(TOOL_SCOPES).sort());
    expect(platformPost).toHaveBeenCalledTimes(1);
  });
});

describe("POST /mcp tools/call", () => {
  it("calling a hidden tool by name returns tool-not-found without contacting Elnora", async () => {
    const calls = (["get", "post", "put", "patch", "del"] as const).map((m) => vi.spyOn(ElnoraApiClient.prototype, m));

    const { status, body } = await rpc({ Authorization: `Bearer ${await seedSignInToken()}` }, "tools/call", {
      name: "elnora_audit_list",
      arguments: { orgId: crypto.randomUUID() },
    });

    expect(status).toBe(200);
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toMatch(/elnora_audit_list not found/);
    for (const call of calls) expect(call).not.toHaveBeenCalled();
    expect(platformPost).not.toHaveBeenCalled();
  });
});
