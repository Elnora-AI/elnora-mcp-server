import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";

export function registerApiKeyTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_list_api_keys",
    {
      title: "List API Keys",
      description: "List all personal API keys.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_list_api_keys", getContext, async () => {
      try {
        const result = await getClient().get("/api-keys");
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_create_api_key",
    {
      title: "Create API Key",
      description: "Create a new personal API key.",
      inputSchema: {
        name: z.string().min(1).max(200).describe("Key name"),
        scopes: z.array(z.string()).optional().describe("Optional scopes"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_create_api_key", getContext, async ({ name, scopes }) => {
      try {
        const result = await getClient().post("/api-keys", { name, scopes });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_revoke_api_key",
    {
      title: "Revoke API Key",
      description: "Revoke (delete) an API key.",
      inputSchema: {
        key_id: z.string().max(255).describe("API key ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_revoke_api_key", getContext, async ({ key_id }) => {
      try {
        await getClient().del(`/api-keys/${key_id}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ revoked: true, keyId: key_id }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
