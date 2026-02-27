import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ElnoraApiClient } from "./services/elnora-api-client.js";
import { ElnoraConfig } from "./types.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerMessageTools } from "./tools/messages.js";
import { registerFileTools } from "./tools/files.js";
import { registerProtocolTools } from "./tools/protocols.js";

export function createElnoraServer(config: ElnoraConfig, getClient: () => ElnoraApiClient): McpServer {
  const server = new McpServer({
    name: "elnora-mcp-server",
    version: "0.1.0",
  });

  registerTaskTools(server, getClient);
  registerMessageTools(server, getClient);
  registerFileTools(server, getClient);
  registerProtocolTools(server, getClient);

  return server;
}
