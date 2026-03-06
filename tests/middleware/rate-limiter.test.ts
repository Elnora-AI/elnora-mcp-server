import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mcpRateLimiter } from "../../src/middleware/rate-limiter.js";

function mockReq(ip: string, authHeader?: string) {
  return {
    ip,
    socket: { remoteAddress: ip },
    headers: authHeader ? { authorization: authHeader } : {},
  } as never;
}

function mockRes() {
  const headers: Record<string, string | number> = {};
  const res = {
    setHeader: vi.fn((k: string, v: string | number) => { headers[k] = v; }),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    _headers: headers,
  };
  return res;
}

describe("mcpRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const limiter = mcpRateLimiter({ maxRequests: 3, windowMs: 60_000 });
    const req = mockReq("127.0.0.1");
    const res = mockRes();
    const next = vi.fn();

    limiter(req, res as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 2);
  });

  it("blocks requests over the limit with 429", () => {
    const limiter = mcpRateLimiter({ maxRequests: 2, windowMs: 60_000 });
    const req = mockReq("127.0.0.1");
    const next = vi.fn();

    // Send 3 requests — the 3rd should be blocked
    for (let i = 0; i < 3; i++) {
      const res = mockRes();
      limiter(req, res as never, next);
      if (i === 2) {
        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ error: "rate_limit_exceeded" }),
        );
      }
    }
    // next was called only twice (first two requests)
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("resets after window expires", () => {
    const limiter = mcpRateLimiter({ maxRequests: 1, windowMs: 1000 });
    const req = mockReq("127.0.0.1");
    const next = vi.fn();

    // First request passes
    limiter(req, mockRes() as never, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Second request blocked
    limiter(req, mockRes() as never, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Advance time past window
    vi.advanceTimersByTime(1100);

    // Third request passes (new window)
    limiter(req, mockRes() as never, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("keys by auth header when present", () => {
    const limiter = mcpRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    const next = vi.fn();

    // Two different auth headers from same IP — separate buckets
    limiter(mockReq("127.0.0.1", "Bearer token-a"), mockRes() as never, next);
    limiter(mockReq("127.0.0.1", "Bearer token-b"), mockRes() as never, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("sets Retry-After header on 429", () => {
    const limiter = mcpRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    const req = mockReq("127.0.0.1");
    const next = vi.fn();

    limiter(req, mockRes() as never, next);

    const res = mockRes();
    limiter(req, res as never, next);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(Number));
  });
});
