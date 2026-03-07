import crypto from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import express, { Request, Response, NextFunction } from "express";
import { ElnoraConfig } from "./types.js";
import { ElnoraApiClient } from "./services/elnora-api-client.js";
import { ElnoraOAuthProvider } from "./auth/provider.js";
import { createElnoraServer } from "./server.js";
import { corsMiddleware } from "./middleware/cors.js";
import { SUPPORTED_SCOPES, ALL_SCOPES } from "./constants.js";
import { logAuthEvent } from "./middleware/tool-logging.js";
import rateLimit from "express-rate-limit";
import axios from "axios";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

function loadConfig(): ElnoraConfig {
  return {
    apiUrl: requireEnv("ELNORA_API_URL"),
    tokenValidationUrl: requireEnv("ELNORA_TOKEN_VALIDATION_URL"),
    port: (() => { const p = parseInt(process.env.PORT || "3000", 10); return Number.isNaN(p) ? 3000 : p; })(),
    publicUrl: requireEnv("ELNORA_PUBLIC_URL"),
    loginUrl: requireEnv("ELNORA_LOGIN_URL"),
    tokenExchangeUrl: requireEnv("ELNORA_TOKEN_EXCHANGE_URL"),
    platformClientId: requireEnv("ELNORA_PLATFORM_CLIENT_ID"),
    platformClientSecret: requireEnv("ELNORA_PLATFORM_CLIENT_SECRET"),
    mcpServiceKey: requireEnv("ELNORA_MCP_SERVICE_KEY"),
  };
}

/**
 * Validate an API key against the Elnora platform.
 * Returns the platform-assigned user identifier on success, or null on failure.
 * The platform is the sole authority — no local format checks gate access.
 */
async function validateApiKeyWithPlatform(
  apiKey: string,
  config: ElnoraConfig,
): Promise<{ userId: string } | null> {
  try {
    const validation = await axios.post(
      config.tokenValidationUrl,
      { token: apiKey },
      { timeout: 10_000, headers: { "X-Service-Key": config.mcpServiceKey } },
    );
    if (validation.data.valid && validation.data.user_id) {
      return { userId: String(validation.data.user_id) };
    }
    return null;
  } catch (err) {
    logAuthEvent("api_key_validation_error", "unknown", { error: err instanceof Error ? err.message : "Unknown error" });
    return null;
  }
}

async function main(): Promise<void> {
  const config = loadConfig();

  // Enforce HTTPS for publicUrl and loginUrl in production (CoSAI MCP-T7)
  for (const [name, url] of [["publicUrl", config.publicUrl], ["loginUrl", config.loginUrl]] as const) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
      throw new Error(`${name} must use HTTPS in production (got ${parsed.protocol}). Use localhost for development.`);
    }
  }

  const app = express();

  // --- Security middleware (CoSAI MCP-T7) ---
  app.use(corsMiddleware(config));
  app.use(express.json({ limit: "1mb" })); // Payload size limit (CoSAI MCP-T10)

  // Security headers — defense-in-depth (CoSAI MCP-T7)
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-XSS-Protection", "0"); // Disabled per OWASP (modern browsers don't need it)
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  // Health check (no auth)
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "elnora-mcp-server" });
  });

  // --- OAuth 2.1 Authorization Server ---
  const provider = new ElnoraOAuthProvider(config);
  const issuerUrl = new URL(config.publicUrl);
  const mcpServerUrl = new URL(`${config.publicUrl}/mcp`);

  // Install OAuth routes: /.well-known/oauth-authorization-server,
  // /.well-known/oauth-protected-resource, /authorize, /token, /register, /revoke
  app.use(
    mcpAuthRouter({
      provider,
      issuerUrl,
      resourceServerUrl: mcpServerUrl,
      scopesSupported: [...SUPPORTED_SCOPES],
      resourceName: "Elnora MCP Server",
      serviceDocumentationUrl: new URL("https://github.com/Elnora-AI/elnora-mcp-server"),
    }),
  );

  // Platform OAuth callback — receives the auth code from Elnora platform login
  // CSRF protection: validates mcp_code exists in our session store (CoSAI MCP-T7)
  // Rate limited to prevent brute-force auth code guessing (CoSAI MCP-T10)
  const callbackLimiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "rate_limit_exceeded", error_description: "Too many callback requests. Please retry later." },
  });
  app.get("/oauth/callback", callbackLimiter, (req, res) => {
    const mcpCode = req.query.mcp_code as string;
    const platformCode = req.query.code as string;
    const platformState = req.query.state as string;

    // All parameters are required for a valid callback — reject if any is missing.
    // An OAuth error response from the platform will also lack `code`, so it's caught here.
    if (!mcpCode || !platformCode || !platformState) {
      const errorParam = req.query.error;
      const context = typeof errorParam === "string" ? errorParam.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 200) : "missing_params";
      logAuthEvent("platform_callback_error", "unknown", { reason: context });
      res.status(400).json({ error: "invalid_request", error_description: "Missing mcp_code, code, or state parameter" });
      return;
    }

    try {
      const redirectUrl = provider.handlePlatformCallback(mcpCode, platformCode, platformState);
      res.redirect(redirectUrl);
    } catch (err) {
      logAuthEvent("platform_callback_failed", "unknown", { error: String(err) });
      res.status(400).json({
        error: "invalid_grant",
        error_description: "Authorization callback failed",
      });
    }
  });

  // --- Auth middleware for /mcp endpoint ---
  const oauthMiddleware = requireBearerAuth({
    verifier: provider,
    requiredScopes: [],
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
  });

  // Rate limiter for /mcp — applied at app level so CodeQL sees it (CoSAI MCP-T10)
  // Non-crypto hash for rate-limiter bucket keys. We only need consistent mapping,
  // not cryptographic security — FNV-1a is fast and avoids CodeQL's password-hash rule.
  function bucketHash(value: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }
  app.use("/mcp", rateLimit({
    windowMs: 60_000,
    limit: 150,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => {
      const authHeader = req.headers.authorization;
      const apiKeyHeader = req.headers["x-api-key"];
      if (authHeader) return `auth:${bucketHash(authHeader)}`;
      if (apiKeyHeader) return `key:${bucketHash(String(apiKeyHeader))}`;
      const ip = req.ip || req.socket.remoteAddress;
      if (!ip) return `ip:unresolved:${crypto.randomUUID()}`;
      // Normalize IPv6-mapped IPv4 (e.g. ::ffff:127.0.0.1 → 127.0.0.1)
      const normalized = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
      return `ip:${normalized}`;
    },
    message: { error: "rate_limit_exceeded", error_description: "Too many requests. Please retry later." },
  }));

  /**
   * Middleware 1: API key authentication (runs first).
   * If X-API-Key header is present, validates against the platform.
   * If valid, sets auth context and calls next(). If invalid, returns 401.
   * If no API key header, calls next() to proceed to OAuth middleware.
   */
  async function apiKeyAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    const apiKey = req.headers["x-api-key"] as string | undefined;

    // codeql[js/user-controlled-bypass] Dual auth by design: both API key and OAuth paths
    // validate credentials server-side. API key is validated by the platform's token endpoint;
    // absence of API key falls through to OAuth bearer token verification in ensureAuthenticated.
    if (!apiKey) {
      next();
      return;
    }

    // Validate against the platform (CoSAI MCP-T7)
    const result = await validateApiKeyWithPlatform(apiKey, config);

    if (!result) {
      logAuthEvent("api_key_rejected", "unknown");
      res.status(401).json({
        error: "invalid_api_key",
        error_description: "API key rejected by platform",
      });
      return;
    }

    // Use platform-assigned user ID as client identifier (no local hashing)
    const apiKeyClientId = `apikey:${result.userId}`;

    // Set auth context compatible with OAuth flow — use SDK's typed req.auth
    // API key users get all scopes — platform enforces permissions
    // Store isApiKeyAuth flag — never store raw API key in extra (leakable if logged)
    req.auth = {
      token: apiKey,
      clientId: apiKeyClientId,
      scopes: ALL_SCOPES,
      extra: { isApiKeyAuth: true },
    } satisfies AuthInfo;

    logAuthEvent("api_key_authenticated", apiKeyClientId);
    next();
  }

  /**
   * Middleware 2: Ensure request is authenticated.
   * If auth context was set by apiKeyAuthMiddleware, proceeds.
   * Otherwise delegates to OAuth bearer token verification.
   */
  function ensureAuthenticated(req: Request, res: Response, next: NextFunction): void {
    if (req.auth) {
      // Already authenticated via API key
      next();
      return;
    }
    // Delegate to OAuth bearer token verification
    oauthMiddleware(req, res, next);
  }

  // --- MCP Endpoint (protected by dual auth — rate limiting applied via app.use above) ---
  app.post("/mcp", apiKeyAuthMiddleware, ensureAuthenticated, async (req: Request, res: Response) => {
    let server: ReturnType<typeof createElnoraServer> | undefined;
    let transport: StreamableHTTPServerTransport | undefined;
    try {
      const auth = req.auth;

      const isApiKeyAuth = auth?.extra?.isApiKeyAuth === true;
      const clientId = auth?.clientId || "unknown";
      const scopes = auth?.scopes || [];

      // Retrieve platform token via provider method (not via AuthInfo.extra — CoSAI MCP-T1)
      const platformToken = !isApiKeyAuth && auth?.token ? provider.getPlatformToken(auth.token) : undefined;

      // Guard against empty/missing platform token
      if (!isApiKeyAuth && !platformToken) {
        res.status(401).json({ error: "invalid_token", error_description: "No platform token available" });
        return;
      }

      // Create per-request API client — API key (from auth.token) or bearer token
      const client = isApiKeyAuth
        ? new ElnoraApiClient(config, { apiKey: auth!.token })
        : new ElnoraApiClient(config, platformToken!);

      const getContext = () => ({ client, clientId, scopes });
      server = createElnoraServer(getContext);

      // Stateless transport — new transport per request
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      res.on("close", () => {
        transport?.close().catch(() => {});
        server?.close().catch(() => {});
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      transport?.close().catch(() => {});
      server?.close().catch(() => {});
      console.error("MCP request error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "internal_error", error_description: "MCP request failed" });
      }
    }
  });

  // GET and DELETE on /mcp return 405 per MCP Streamable HTTP spec (stateless mode)
  app.get("/mcp", (_req, res) => {
    res.status(405).json({ error: "method_not_allowed", error_description: "Stateless server — use POST" });
  });
  app.delete("/mcp", (_req, res) => {
    res.status(405).json({ error: "method_not_allowed", error_description: "Stateless server — sessions not supported" });
  });

  const host = process.env.HOST || "0.0.0.0";
  const httpServer = app.listen(config.port, host, () => {
    console.error(`Elnora MCP server running on http://${host}:${config.port}/mcp`);
    console.error(`OAuth AS Metadata: ${config.publicUrl}/.well-known/oauth-authorization-server`);
    console.error(`Protected Resource Metadata: ${getOAuthProtectedResourceMetadataUrl(mcpServerUrl)}`);
    console.error(`API Key auth: Send X-API-Key header`);
    console.error(`Health check: http://localhost:${config.port}/health`);
  });

  // Graceful shutdown — let in-flight requests drain before ECS kills the process
  const gracefulShutdown = (signal: string) => {
    console.error(`${signal} received — shutting down gracefully`);
    httpServer.close(() => {
      process.exit(0);
    });
    // Force-exit after 25s if connections haven't drained
    setTimeout(() => process.exit(1), 25_000).unref();
  };
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Handle server-level errors (port in use, etc.) — prevents unhandled crash
  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${config.port} is already in use`);
    } else {
      console.error("HTTP server error:", err);
    }
    process.exit(1);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
