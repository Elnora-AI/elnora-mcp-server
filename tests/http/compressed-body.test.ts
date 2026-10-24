import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { gzipSync } from "node:zlib";
import { createApp } from "../../src/app.js";
import { InMemoryTokenStore } from "../../src/auth/in-memory-token-store.js";
import { InMemoryClientsStore } from "../../src/auth/clients-store.js";
import type { ElnoraConfig } from "../../src/types.js";

/**
 * GHSA-27r3-jxmh-p828: before body-parser 2.4.0, bytes after a gzip body raised an error nothing was
 * listening for, which took the process down after the response had been sent. Guards the
 * "body-parser" override in package.json.
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

const TRAILING_BYTES = Buffer.concat([Buffer.from([0x00]), Buffer.alloc(100 * 1024, 0x58)]);

let server: Server;
let baseUrl: string;
const uncaught: unknown[] = [];
const recordUncaught = (err: unknown) => {
  uncaught.push(err);
};

beforeAll(async () => {
  process.on("uncaughtException", recordUncaught);
  const app = createApp(config, new InMemoryTokenStore(), new InMemoryClientsStore(false));
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  process.off("uncaughtException", recordUncaught);
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("gzip request body with trailing bytes", () => {
  it.each([
    ["/mcp", "application/json", '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'],
    ["/not-a-route", "application/json", '{"a":1}'],
    ["/oauth/consent", "application/x-www-form-urlencoded", "decision=allow&mcp_code=x"],
    ["/token", "application/x-www-form-urlencoded", "grant_type=authorization_code&code=x"],
  ])("POST %s leaves the server running", async (path, contentType, body) => {
    uncaught.length = 0;
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": contentType, "Content-Encoding": "gzip" },
      body: Buffer.concat([gzipSync(body), TRAILING_BYTES]),
    });
    await res.body?.cancel();
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(uncaught).toEqual([]);
    expect((await fetch(`${baseUrl}/health`)).status).toBe(200);
  });
});
