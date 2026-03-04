import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import express from "express";
import { ElnoraConfig } from "./types.js";
import { ElnoraApiClient } from "./services/elnora-api-client.js";
import { ElnoraOAuthProvider } from "./auth/provider.js";
import { createElnoraServer } from "./server.js";
import { corsMiddleware } from "./middleware/cors.js";
import { mcpRateLimiter } from "./middleware/rate-limiter.js";
import { SUPPORTED_SCOPES } from "./constants.js";

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
    authUrl: requireEnv("ELNORA_AUTH_URL"),
    tokenValidationUrl: requireEnv("ELNORA_TOKEN_VALIDATION_URL"),
    port: parseInt(process.env.PORT || "3000", 10),
    publicUrl: requireEnv("ELNORA_PUBLIC_URL"),
    loginUrl: requireEnv("ELNORA_LOGIN_URL"),
    tokenExchangeUrl: requireEnv("ELNORA_TOKEN_EXCHANGE_URL"),
    platformClientId: requireEnv("ELNORA_PLATFORM_CLIENT_ID"),
    platformClientSecret: requireEnv("ELNORA_PLATFORM_CLIENT_SECRET"),
  };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const app = express();

  // --- Security middleware (CoSAI MCP-T7) ---
  app.use(corsMiddleware(config));
  app.use(express.json({ limit: "1mb" })); // Payload size limit (CoSAI MCP-T10)

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
      console.error(`[auth] platform callback error: ${error}`);
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
      console.error("[auth] platform callback failed:", err);
      res.status(400).json({
        error: "invalid_grant",
        error_description: err instanceof Error ? err.message : "Callback processing failed",
      });
    }
  });

  // --- MCP Endpoint (protected by bearer auth + rate limiting) ---
  const authMiddleware = requireBearerAuth({
    verifier: provider,
    requiredScopes: [],
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
  });

  app.post("/mcp", mcpRateLimiter(), authMiddleware, async (req, res) => {
    try {
      // Extract auth context (set by provider.verifyAccessToken)
      const platformToken = (req.auth?.extra?.platformToken as string) || "";
      const clientId = req.auth?.clientId || "unknown";
      const scopes = req.auth?.scopes || [];

      // Create per-request MCP server and API client with auth context
      const client = new ElnoraApiClient(config, platformToken);
      const getContext = () => ({ client, clientId, scopes });
      const server = createElnoraServer(config, getContext);

      // Stateless transport — new transport per request
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      res.on("close", () => transport.close());
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

  app.listen(config.port, () => {
    console.error(`Elnora MCP server running on http://localhost:${config.port}/mcp`);
    console.error(`OAuth AS Metadata: ${config.publicUrl}/.well-known/oauth-authorization-server`);
    console.error(`Protected Resource Metadata: ${getOAuthProtectedResourceMetadataUrl(mcpServerUrl)}`);
    console.error(`Health check: http://localhost:${config.port}/health`);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
