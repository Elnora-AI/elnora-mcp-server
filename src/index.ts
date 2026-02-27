import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { ElnoraConfig } from "./types.js";
import { ElnoraApiClient } from "./services/elnora-api-client.js";
import { authMiddleware } from "./auth/middleware.js";
import { protectedResourceMetadataHandler } from "./auth/protected-resource.js";
import { createElnoraServer } from "./server.js";

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
  };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const app = express();
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "elnora-mcp-server" });
  });

  // OAuth Protected Resource Metadata (per MCP spec, RFC 9728)
  app.get("/.well-known/oauth-protected-resource", protectedResourceMetadataHandler(config));

  // MCP endpoint with auth
  app.post("/mcp", authMiddleware(config), async (req, res) => {
    try {
      // Create per-request MCP server and API client
      const client = new ElnoraApiClient(config, req.bearerToken!);
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
    console.error(
      `Protected Resource Metadata: http://localhost:${config.port}/.well-known/oauth-protected-resource`,
    );
    console.error(`Health check: http://localhost:${config.port}/health`);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
