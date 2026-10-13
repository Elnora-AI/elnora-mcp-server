import { getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { ElnoraConfig } from "./types.js";
import { RedisTokenStore } from "./auth/redis-token-store.js";
import { RedisClientsStore } from "./auth/redis-clients-store.js";
import { TokenStore } from "./auth/token-store.js";
import { createApp } from "./app.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

/** Parse a boolean env var: only "true" / "1" (case-insensitive) enable it. Absent/anything else = false. */
function parseBoolEnv(name: string): boolean {
  const value = (process.env[name] || "").trim().toLowerCase();
  return value === "true" || value === "1";
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
    redisUrl: requireEnv("REDIS_URL"),
    allowHostedClients: parseBoolEnv("ELNORA_MCP_ALLOW_HOSTED_CLIENTS"),
  };
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

  // --- Redis stores (fail-closed — server won't start without Redis) ---
  const store: TokenStore = new RedisTokenStore(config.redisUrl);
  await store.ping();
  console.error("Redis token store connected");

  const clientsStore = new RedisClientsStore(config.redisUrl, config.allowHostedClients);
  await clientsStore.ping();
  console.error("Redis clients store connected");
  console.error(`Hosted (non-loopback) OAuth clients: ${config.allowHostedClients ? "ENABLED (consent-gated)" : "disabled (loopback-only)"}`);

  const app = createApp(config, store, clientsStore);
  const mcpServerUrl = new URL(`${config.publicUrl}/mcp`);

  const host = process.env.HOST || "0.0.0.0";
  const httpServer = app.listen(config.port, host, () => {
    console.error(`Elnora MCP server running on http://${host}:${config.port}/mcp`);
    console.error(`OAuth AS Metadata: ${config.publicUrl}/.well-known/oauth-authorization-server`);
    console.error(`Protected Resource Metadata: ${getOAuthProtectedResourceMetadataUrl(mcpServerUrl)}`);
    console.error(`API Key auth: Send X-API-Key header`);
    console.error(`Health check: http://localhost:${config.port}/health`);
  });

  // Heartbeat — emits one structured log line per minute with uptime and memory.
  const heartbeatStartedAt = Date.now();
  const heartbeatInterval = setInterval(() => {
    const uptimeSec = Math.floor((Date.now() - heartbeatStartedAt) / 1000);
    const mem = process.memoryUsage();
    const rssMb = Math.round(mem.rss / 1024 / 1024);
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    console.error(`heartbeat uptime_sec=${uptimeSec} rss_mb=${rssMb} heap_used_mb=${heapUsedMb}`);
  }, 60_000);
  heartbeatInterval.unref();

  // Graceful shutdown — let in-flight requests drain before ECS kills the process
  const gracefulShutdown = async (signal: string) => {
    console.error(`${signal} received — shutting down gracefully`);
    clearInterval(heartbeatInterval);
    httpServer.close(async () => {
      await clientsStore.disconnect();
      await store.disconnect();
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
