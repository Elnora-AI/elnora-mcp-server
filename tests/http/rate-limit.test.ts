import { describe, it, expect, afterEach } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "../../src/app.js";
import { InMemoryTokenStore } from "../../src/auth/in-memory-token-store.js";
import { InMemoryClientsStore } from "../../src/auth/clients-store.js";
import type { ElnoraConfig } from "../../src/types.js";

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

const MCP_LIMIT = 150;

let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

async function boot(): Promise<string> {
  const app = createApp(config, new InMemoryTokenStore(), new InMemoryClientsStore(false));
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

/** An unauthenticated request whose client address (via the trusted proxy hop) is `ip`. */
async function getMcpFrom(baseUrl: string, ip: string): Promise<number> {
  const res = await fetch(`${baseUrl}/mcp`, { headers: { "X-Forwarded-For": ip } });
  await res.body?.cancel();
  return res.status;
}

describe("/mcp rate limit for unauthenticated clients", () => {
  it("counts IPv6 addresses from the same /56 network as one client", async () => {
    const baseUrl = await boot();
    for (let i = 0; i < MCP_LIMIT; i++) {
      expect(await getMcpFrom(baseUrl, "2001:db8:abcd:1200::1")).toBe(405);
    }

    expect(await getMcpFrom(baseUrl, "2001:db8:abcd:12ff::2")).toBe(429);
    expect(await getMcpFrom(baseUrl, "2001:db8:abcd:1300::1")).toBe(405);
  });

  it("counts an IPv4-mapped IPv6 address as its IPv4 address", async () => {
    const baseUrl = await boot();
    for (let i = 0; i < MCP_LIMIT; i++) {
      expect(await getMcpFrom(baseUrl, "203.0.113.7")).toBe(405);
    }

    expect(await getMcpFrom(baseUrl, "::ffff:203.0.113.7")).toBe(429);
    expect(await getMcpFrom(baseUrl, "203.0.113.8")).toBe(405);
  });
});
