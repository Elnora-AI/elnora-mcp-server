import { RequestHandler } from "express";
import { ElnoraConfig } from "../types.js";

/**
 * CORS middleware restricting origins to the Elnora platform domain.
 * CoSAI MCP-T7: Prevent cross-origin data leaks and CORS policy bypass.
 *
 * MCP clients communicate via direct HTTP (not browser), so CORS is primarily
 * defense-in-depth against browser-based attacks targeting the MCP endpoint.
 */
export function corsMiddleware(config: ElnoraConfig): RequestHandler {
  const publicOrigin = new URL(config.publicUrl).origin;
  const platformOrigin = config.loginUrl ? new URL(config.loginUrl).origin : null;

  // Allowed origins: the MCP server itself and the platform
  const allowedOrigins = new Set<string>([publicOrigin]);
  if (platformOrigin) allowedOrigins.add(platformOrigin);

  // Allow configuring additional origins via env var (comma-separated)
  // Each value is parsed as a URL and normalized to its origin (scheme + host)
  const extraOrigins = process.env.CORS_ALLOWED_ORIGINS;
  if (extraOrigins) {
    for (const origin of extraOrigins.split(",")) {
      const trimmed = origin.trim();
      if (trimmed) {
        try {
          const parsed = new URL(trimmed);
          if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
            console.error(`CORS_ALLOWED_ORIGINS: ignoring non-HTTPS origin "${trimmed}"`);
            continue;
          }
          allowedOrigins.add(parsed.origin);
        } catch {
          console.error(`CORS_ALLOWED_ORIGINS: ignoring invalid origin "${trimmed}"`);
        }
      }
    }
  }

  return (req, res, next) => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, MCP-Protocol-Version");
      res.setHeader("Access-Control-Max-Age", "86400");
      // Never expose tokens or auth headers to browsers
      res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate");
    }

    if (req.method === "OPTIONS") {
      if (origin && !allowedOrigins.has(origin)) {
        res.status(403).end();
        return;
      }
      res.status(204).end();
      return;
    }

    next();
  };
}
