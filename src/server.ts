import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ElnoraApiClient } from "./services/elnora-api-client.js";
import { ElnoraConfig } from "./types.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerMessageTools } from "./tools/messages.js";
import { registerFileTools } from "./tools/files.js";
import { registerProtocolTools } from "./tools/protocols.js";

export interface RequestContext {
  client: ElnoraApiClient;
  clientId: string;
  scopes: string[];
}

export function createElnoraServer(
  config: ElnoraConfig,
  getContext: () => RequestContext,
): McpServer {
  const server = new McpServer({
    name: "elnora-mcp-server",
    version: "0.2.0",
  });

  const getClient = () => getContext().client;

  registerTaskTools(server, getClient, getContext);
  registerMessageTools(server, getClient, getContext);
  registerFileTools(server, getClient, getContext);
  registerProtocolTools(server, getClient, getContext);

  return server;
}
