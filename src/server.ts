import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createRequire } from "node:module";
import type { ElnoraApiClient } from "./services/elnora-api-client.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerMessageTools } from "./tools/messages.js";
import { registerFileTools } from "./tools/files.js";
import { registerProtocolTools } from "./tools/protocols.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerOrgTools } from "./tools/orgs.js";
import { registerFolderTools } from "./tools/folders.js";
import { registerLibraryTools } from "./tools/library.js";
import { registerSearchTools } from "./tools/search.js";
import { registerApiKeyTools } from "./tools/api-keys.js";
import { registerAuditTools } from "./tools/audit.js";
import { registerAccountTools } from "./tools/account.js";
import { registerFeedbackTools } from "./tools/feedback.js";
import { registerFlagTools } from "./tools/flags.js";
import { registerHealthTools } from "./tools/health.js";

// Hoist to module scope — runs once at import time, not per-request
const _require = createRequire(import.meta.url);
const { version } = _require("../package.json") as { version: string };

export interface RequestContext {
  client: ElnoraApiClient;
  clientId: string;
  scopes: string[];
}

export function createElnoraServer(
  getContext: () => RequestContext,
): McpServer {
  const server = new McpServer({
    name: "elnora-mcp-server",
    version,
  });

  const getClient = () => getContext().client;

  // Core tools
  registerTaskTools(server, getClient, getContext);
  registerMessageTools(server, getClient, getContext);
  registerFileTools(server, getClient, getContext);
  registerProtocolTools(server, getClient, getContext);

  // Project & org management
  registerProjectTools(server, getClient, getContext);
  registerOrgTools(server, getClient, getContext);
  registerFolderTools(server, getClient, getContext);
  registerLibraryTools(server, getClient, getContext);

  // Search & discovery
  registerSearchTools(server, getClient, getContext);

  // Admin & utility
  registerApiKeyTools(server, getClient, getContext);
  registerAuditTools(server, getClient, getContext);
  registerAccountTools(server, getClient, getContext);
  registerFeedbackTools(server, getClient, getContext);
  registerFlagTools(server, getClient, getContext);
  registerHealthTools(server, getClient, getContext);

  return server;
}
