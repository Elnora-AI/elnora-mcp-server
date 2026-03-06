import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import express, { Request, Response, NextFunction } from "express";
import { ElnoraConfig } from "./types.js";
import { ElnoraApiClient } from "./services/elnora-api-client.js";
import { ElnoraOAuthProvider } from "./auth/provider.js";
import { createElnoraServer } from "./server.js";
import { corsMiddleware } from "./middleware/cors.js";
import { mcpRateLimiter } from "./middleware/rate-limiter.js";
import { SUPPORTED_SCOPES, ALL_SCOPES, API_KEY_PREFIX, API_KEY_MIN_LENGTH } from "./constants.js";
import { logAuthEvent } from "./middleware/tool-logging.js";
import crypto from "node:crypto";

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
  };
}

/**
 * Validate API key format (matches elnora-cli validation).
 * Must start with "elnora_live_" and be at least 20 characters.
 */
function isValidApiKey(key: string): boolean {
  return key.startsWith(API_KEY_PREFIX) && key.length >= API_KEY_MIN_LENGTH;
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
  app.get("/oauth/callback", (req, res) => {
    const mcpCode = req.query.mcp_code as string;
    const platformCode = req.query.code as string;
    const error = req.query.error as string;

    if (error) {
      logAuthEvent("platform_callback_error", "unknown", { error });
      res.status(400).json({ error: "platform_auth_failed", error_description: error });
      return;
    }

    if (!mcpCode || !platformCode) {
      res.status(400).json({ error: "invalid_request", error_description: "Missing mcp_code or code parameter" });
      return;
    }

    try {
      provider.handlePlatformCallback(mcpCode, platformCode);
      const redirectUrl = provider.getClientRedirectUrl(mcpCode);
      res.redirect(redirectUrl);
    } catch (err) {
      logAuthEvent("platform_callback_failed", "unknown", { error: String(err) });
      res.status(400).json({
        error: "invalid_grant",
        error_description: err instanceof Error ? err.message : "Callback processing failed",
      });
    }
  });

  // --- Auth middleware for /mcp endpoint ---
  const oauthMiddleware = requireBearerAuth({
    verifier: provider,
    requiredScopes: [],
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
  });

  /**
   * API Key + OAuth dual auth middleware.
   * Checks for X-API-Key header first. If present and valid, bypasses OAuth.
   * Otherwise falls through to OAuth bearer token validation.
   */
  function dualAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
    const apiKey = req.headers["x-api-key"] as string | undefined;

    if (apiKey) {
      // API key auth path
      if (!isValidApiKey(apiKey)) {
        logAuthEvent("api_key_rejected", "unknown", { reason: "invalid_format" });
        res.status(401).json({
          error: "invalid_api_key",
          error_description: "Invalid API key",
        });
        return;
      }

      // Derive unique clientId from API key hash (CoSAI MCP-T12: per-key audit trail)
      const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 12);
      const apiKeyClientId = `apikey:${keyHash}`;

      // Set auth context compatible with OAuth flow
      // API key users get all scopes — platform enforces permissions
      (req as unknown as Record<string, unknown>).auth = {
        token: apiKey,
        clientId: apiKeyClientId,
        scopes: ALL_SCOPES,
        extra: { apiKey },
      };

      logAuthEvent("api_key_authenticated", apiKeyClientId);
      next();
      return;
    }

    // Fall through to OAuth bearer auth
    oauthMiddleware(req, res, next);
  }

  // --- MCP Endpoint (protected by dual auth + rate limiting) ---
  app.post("/mcp", mcpRateLimiter(), dualAuthMiddleware, async (req, res) => {
    try {
      const auth = (req as unknown as Record<string, unknown>).auth as {
        extra?: { platformToken?: string; apiKey?: string };
        clientId?: string;
        scopes?: string[];
      } | undefined;

      const apiKey = auth?.extra?.apiKey as string | undefined;
      const platformToken = (auth?.extra?.platformToken as string) || "";
      const clientId = auth?.clientId || "unknown";
      const scopes = auth?.scopes || [];

      // Create per-request API client — API key or bearer token
      const client = apiKey
        ? new ElnoraApiClient(config, { apiKey })
        : new ElnoraApiClient(config, platformToken);

      const getContext = () => ({ client, clientId, scopes });
      const server = createElnoraServer(config, getContext);

      // Stateless transport — new transport per request
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      res.on("close", () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
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

  const host = process.env.HOST || "127.0.0.1";
  const httpServer = app.listen(config.port, host, () => {
    console.error(`Elnora MCP server running on http://${host}:${config.port}/mcp`);
    console.error(`OAuth AS Metadata: ${config.publicUrl}/.well-known/oauth-authorization-server`);
    console.error(`Protected Resource Metadata: ${getOAuthProtectedResourceMetadataUrl(mcpServerUrl)}`);
    console.error(`API Key auth: Send X-API-Key header with elnora_live_* key`);
    console.error(`Health check: http://localhost:${config.port}/health`);
  });

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
