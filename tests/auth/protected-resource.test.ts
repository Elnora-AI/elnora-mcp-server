import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { protectedResourceMetadataHandler } from "../../src/auth/protected-resource.js";
import type { ElnoraConfig } from "../../src/types.js";

function mockReqRes(protocol = "https", host = "mcp.example.com") {
  const req = {
    protocol,
    get: vi.fn((header: string) => (header === "host" ? host : undefined)),
  } as never;
  const jsonFn = vi.fn();
  const res = { json: jsonFn } as never;
  return { req, res, jsonFn };
}

const config: ElnoraConfig = {
  apiUrl: "https://api.example.com",
  authUrl: "https://auth.example.com",
  tokenValidationUrl: "https://api.example.com/auth/validate-token",
  port: 3001,
};

describe("protectedResourceMetadataHandler", () => {
  const originalEnv = process.env.RESOURCE_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.RESOURCE_URL;
    } else {
      process.env.RESOURCE_URL = originalEnv;
    }
  });

  it("returns JSON with all required RFC 9728 fields", () => {
    delete process.env.RESOURCE_URL;
    const { req, res, jsonFn } = mockReqRes();
    protectedResourceMetadataHandler(config)(req, res);

    const body = jsonFn.mock.calls[0][0];
    expect(body).toHaveProperty("resource");
    expect(body).toHaveProperty("authorization_servers");
    expect(body).toHaveProperty("scopes_supported");
    expect(body).toHaveProperty("bearer_methods_supported");
  });

  it("authorization_servers contains config.authUrl", () => {
    delete process.env.RESOURCE_URL;
    const { req, res, jsonFn } = mockReqRes();
    protectedResourceMetadataHandler(config)(req, res);

    const body = jsonFn.mock.calls[0][0];
    expect(body.authorization_servers).toContain("https://auth.example.com");
  });

  it("scopes_supported contains all 6 scopes", () => {
    delete process.env.RESOURCE_URL;
    const { req, res, jsonFn } = mockReqRes();
    protectedResourceMetadataHandler(config)(req, res);

    const body = jsonFn.mock.calls[0][0];
    expect(body.scopes_supported).toEqual([
      "tasks:read",
      "tasks:write",
      "files:read",
      "files:write",
      "messages:read",
      "messages:write",
    ]);
  });

  it('bearer_methods_supported is ["header"]', () => {
    delete process.env.RESOURCE_URL;
    const { req, res, jsonFn } = mockReqRes();
    protectedResourceMetadataHandler(config)(req, res);

    const body = jsonFn.mock.calls[0][0];
    expect(body.bearer_methods_supported).toEqual(["header"]);
  });

  it("uses RESOURCE_URL env var when set", () => {
    process.env.RESOURCE_URL = "https://custom.resource.url";
    const { req, res, jsonFn } = mockReqRes();
    protectedResourceMetadataHandler(config)(req, res);

    const body = jsonFn.mock.calls[0][0];
    expect(body.resource).toBe("https://custom.resource.url");
  });

  it("derives resource from req.protocol + req.get('host') when env var not set", () => {
    delete process.env.RESOURCE_URL;
    const { req, res, jsonFn } = mockReqRes("https", "mcp.example.com");
    protectedResourceMetadataHandler(config)(req, res);

    const body = jsonFn.mock.calls[0][0];
    expect(body.resource).toBe("https://mcp.example.com");
  });
});
