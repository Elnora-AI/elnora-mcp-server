import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";
import { OUTPUT_OPTIONS_SCHEMA } from "../services/response-formatter.js";

export function registerApiKeyTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_api-keys_list",
    {
      title: "elnora_api-keys_list",
      description: "List all API keys",
      inputSchema: {
        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_api-keys_list", getContext, async () => {
      try {
        const result = await getClient().get("/api-keys");
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_api-keys_create",
    {
      title: "elnora_api-keys_create",
      description: "Create a new API key",
      inputSchema: {
        name: z.string().min(1).max(200).describe("Key name"),
        scopes: z.array(z.string()).optional().describe("Optional scopes"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_api-keys_create", getContext, async ({ name, scopes }) => {
      try {
        const result = await getClient().post("/api-keys", { name, scopes });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_api-keys_revoke",
    {
      title: "elnora_api-keys_revoke",
      description: "Revoke an API key",
      inputSchema: {
        keyId: z.string().min(1).max(255).describe("API key ID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_api-keys_revoke", getContext, async ({ keyId }) => {
      try {
        await getClient().del(`/api-keys/${keyId}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ revoked: true, keyId }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_api-keys_getPolicy",
    {
      title: "elnora_api-keys_getPolicy",
      description: "Get the API key creation policy",
      inputSchema: {
        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_api-keys_getPolicy", getContext, async () => {
      try {
        const result = await getClient().get("/api-keys/policy");
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_api-keys_setPolicy",
    {
      title: "elnora_api-keys_setPolicy",
      description: "Set the API key creation policy",
      inputSchema: {
        policy: z.record(z.string(), z.unknown()).describe("Policy object"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_api-keys_setPolicy", getContext, async ({ policy }) => {
      try {
        const result = await getClient().put("/api-keys/policy", policy);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
