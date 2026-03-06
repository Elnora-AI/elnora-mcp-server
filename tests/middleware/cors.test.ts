import { describe, it, expect, vi } from "vitest";
import { corsMiddleware } from "../../src/middleware/cors.js";
import type { ElnoraConfig } from "../../src/types.js";

const config: ElnoraConfig = {
  apiUrl: "https://api.elnora.ai",
  tokenValidationUrl: "https://api.elnora.ai/auth/validate-token",
  port: 3000,
  publicUrl: "https://mcp.elnora.ai",
  loginUrl: "https://platform.elnora.ai/login",
  tokenExchangeUrl: "https://api.elnora.ai/oauth/token",
  platformClientId: "mcp-server",
  platformClientSecret: "secret",
};

function mockReq(origin?: string, method = "POST") {
  return {
    headers: origin ? { origin } : {},
    method,
  } as never;
}

function mockRes() {
  const headers: Record<string, string> = {};
  return {
    setHeader: vi.fn((k: string, v: string) => { headers[k] = v; }),
    status: vi.fn().mockReturnThis(),
    end: vi.fn(),
    _headers: headers,
  };
}

describe("corsMiddleware", () => {
  it("sets Access-Control-Allow-Origin for allowed origin", () => {
    const middleware = corsMiddleware(config);
    const res = mockRes();
    const next = vi.fn();

    middleware(mockReq("https://mcp.elnora.ai"), res as never, next);

    expect(res.setHeader).toHaveBeenCalledWith("Access-Control-Allow-Origin", "https://mcp.elnora.ai");
    expect(next).toHaveBeenCalled();
  });

  it("allows platform origin", () => {
    const middleware = corsMiddleware(config);
    const res = mockRes();
    const next = vi.fn();

    middleware(mockReq("https://platform.elnora.ai"), res as never, next);

    expect(res.setHeader).toHaveBeenCalledWith("Access-Control-Allow-Origin", "https://platform.elnora.ai");
  });

  it("does not set origin header for disallowed origin", () => {
    const middleware = corsMiddleware(config);
    const res = mockRes();
    const next = vi.fn();

    middleware(mockReq("https://evil.com"), res as never, next);

    const originCalls = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: string[]) => c[0] === "Access-Control-Allow-Origin",
    );
    expect(originCalls).toHaveLength(0);
    expect(next).toHaveBeenCalled();
  });

  it("returns 204 for OPTIONS preflight", () => {
    const middleware = corsMiddleware(config);
    const res = mockRes();
    const next = vi.fn();

    middleware(mockReq("https://mcp.elnora.ai", "OPTIONS"), res as never, next);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("includes X-API-Key in allowed headers for allowed origin", () => {
    const middleware = corsMiddleware(config);
    const res = mockRes();
    const next = vi.fn();

    // CORS headers are now only set for allowed origins (security fix)
    middleware(mockReq("https://mcp.elnora.ai"), res as never, next);

    const headerCalls = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls;
    const allowHeaders = headerCalls.find((c: string[]) => c[0] === "Access-Control-Allow-Headers");
    expect(allowHeaders?.[1]).toContain("X-API-Key");
  });

  it("returns 204 for OPTIONS from disallowed origin without CORS headers", () => {
    const middleware = corsMiddleware(config);
    const res = mockRes();
    const next = vi.fn();

    middleware(mockReq("https://evil.com", "OPTIONS"), res as never, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.end).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();

    // Should NOT set any CORS headers for disallowed origin
    const originCalls = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: string[]) => c[0] === "Access-Control-Allow-Origin",
    );
    expect(originCalls).toHaveLength(0);
    const methodCalls = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: string[]) => c[0] === "Access-Control-Allow-Methods",
    );
    expect(methodCalls).toHaveLength(0);
  });

  it("does not set CORS method/header for disallowed origin", () => {
    const middleware = corsMiddleware(config);
    const res = mockRes();
    const next = vi.fn();

    middleware(mockReq("https://evil.com"), res as never, next);

    const headerCalls = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls;
    const allowMethods = headerCalls.find((c: string[]) => c[0] === "Access-Control-Allow-Methods");
    expect(allowMethods).toBeUndefined();
  });
});
