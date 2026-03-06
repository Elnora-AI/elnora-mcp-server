import { RequestHandler } from "express";
import { logRateLimitEvent } from "./tool-logging.js";

/**
 * Simple in-memory rate limiter for the /mcp endpoint.
 * CoSAI MCP-T10: Prevent resource exhaustion and denial-of-wallet attacks.
 *
 * Limits by client IP (or Authorization header hash for authenticated requests).
 * Default: 60 requests per minute per client.
 */
export function mcpRateLimiter(opts?: { maxRequests?: number; windowMs?: number }): RequestHandler {
  const maxRequests = opts?.maxRequests ?? 60;
  const windowMs = opts?.windowMs ?? 60_000;
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Periodic cleanup to prevent memory leak
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits) {
      if (record.resetAt <= now) hits.delete(key);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    // Key by bearer token (if present) or IP
    const authHeader = req.headers.authorization;
    const key = authHeader
      ? `auth:${simpleHash(authHeader)}`
      : `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;

    const now = Date.now();
    let record = hits.get(key);

    if (!record || record.resetAt <= now) {
      record = { count: 0, resetAt: now + windowMs };
      hits.set(key, record);
    }

    record.count++;

    // Set standard rate limit headers
    const remaining = Math.max(0, maxRequests - record.count);
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetAt / 1000));

    if (record.count > maxRequests) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader("Retry-After", retryAfter);
      logRateLimitEvent(key, record.count, maxRequests);
      res.status(429).json({
        error: "rate_limit_exceeded",
        error_description: `Too many requests. Retry after ${retryAfter} seconds.`,
      });
      return;
    }

    next();
  };
}

/** Fast non-crypto hash for rate limit keying — not for security */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}
