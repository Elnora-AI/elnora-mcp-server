import { describe, it, expect, vi, beforeEach } from "vitest";
import { authMiddleware } from "../../src/auth/middleware.js";
import { ElnoraApiClient } from "../../src/services/elnora-api-client.js";
import type { ElnoraConfig, TokenValidationResult } from "../../src/types.js";

vi.mock("../../src/services/elnora-api-client.js", () => ({
  ElnoraApiClient: {
    validateToken: vi.fn(),
  },
}));

const config: ElnoraConfig = {
  apiUrl: "https://api.example.com",
  authUrl: "https://auth.example.com",
  tokenValidationUrl: "https://api.example.com/auth/validate-token",
  port: 3001,
};

function mockReqResNext(authHeader?: string) {
  const req = {
    headers: authHeader !== undefined ? { authorization: authHeader } : {},
    protocol: "https",
    get: vi.fn((h: string) => (h === "host" ? "mcp.example.com" : undefined)),
  } as never;
  const statusFn = vi.fn().mockReturnThis();
  const jsonFn = vi.fn();
  const setHeaderFn = vi.fn();
  const res = { status: statusFn, json: jsonFn, setHeader: setHeaderFn } as never;
  const next = vi.fn();
  return { req, res, next, statusFn, jsonFn, setHeaderFn };
}

describe("authMiddleware", () => {
  const middleware = authMiddleware(config);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 with WWW-Authenticate when no Authorization header", async () => {
    const { req, res, next, statusFn, jsonFn, setHeaderFn } = mockReqResNext();
    await middleware(req, res, next);

    expect(setHeaderFn).toHaveBeenCalledWith("WWW-Authenticate", expect.stringContaining("Bearer"));
    expect(statusFn).toHaveBeenCalledWith(401);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ error: "unauthorized" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header lacks Bearer prefix", async () => {
    const { req, res, next, statusFn, jsonFn } = mockReqResNext("Basic abc123");
    await middleware(req, res, next);

    expect(statusFn).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for empty Bearer token", async () => {
    const { req, res, next, statusFn } = mockReqResNext("Bearer ");
    vi.mocked(ElnoraApiClient.validateToken).mockResolvedValue({
      valid: false,
    });
    await middleware(req, res, next);

    expect(statusFn).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 invalid_token when validation returns valid: false", async () => {
    const { req, res, next, statusFn, jsonFn } = mockReqResNext("Bearer bad-token");
    vi.mocked(ElnoraApiClient.validateToken).mockResolvedValue({
      valid: false,
    });
    await middleware(req, res, next);

    expect(statusFn).toHaveBeenCalledWith(401);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ error: "invalid_token" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when validation returns valid but no userId", async () => {
    const { req, res, next, statusFn } = mockReqResNext("Bearer partial-token");
    vi.mocked(ElnoraApiClient.validateToken).mockResolvedValue({
      valid: true,
      organizationId: "org-1",
    });
    await middleware(req, res, next);

    expect(statusFn).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when validateToken throws", async () => {
    const { req, res, next, statusFn, jsonFn } = mockReqResNext("Bearer throw-token");
    vi.mocked(ElnoraApiClient.validateToken).mockRejectedValue(new Error("network"));
    await middleware(req, res, next);

    expect(statusFn).toHaveBeenCalledWith(401);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ error: "invalid_token" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("sets authContext and bearerToken, calls next() for valid token", async () => {
    const { req, res, next } = mockReqResNext("Bearer good-token");
    vi.mocked(ElnoraApiClient.validateToken).mockResolvedValue({
      valid: true,
      userId: 42,
      organizationId: "org-123",
      scopes: "tasks:read tasks:write",
      tokenType: "jwt",
    });
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as Record<string, unknown>).authContext).toEqual({
      userId: 42,
      organizationId: "org-123",
      scopes: "tasks:read tasks:write",
      tokenType: "jwt",
    });
    expect((req as Record<string, unknown>).bearerToken).toBe("good-token");
  });
});
