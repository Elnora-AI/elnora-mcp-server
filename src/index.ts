import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import express from "express";
import { ElnoraConfig } from "./types.js";
import { ElnoraApiClient } from "./services/elnora-api-client.js";
import { ElnoraOAuthProvider } from "./auth/provider.js";
import { createElnoraServer } from "./server.js";
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
  app.use(express.json());

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

  // --- MCP Endpoint (protected by bearer auth) ---
  const authMiddleware = requireBearerAuth({
    verifier: provider,
    requiredScopes: [],
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
  });

  app.post("/mcp", authMiddleware, async (req, res) => {
    try {
      // Extract platform token from auth info (set by provider.verifyAccessToken)
      const platformToken = (req.auth?.extra?.platformToken as string) || "";

      // Create per-request MCP server and API client
      const client = new ElnoraApiClient(config, platformToken);
      const getClient = () => client;
      const server = createElnoraServer(config, getClient);

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
