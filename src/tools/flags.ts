import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";

export function registerFlagTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_list_flags",
    {
      title: "List Feature Flags",
      description: "List all global feature flags (no specific scope required).",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_list_flags", getContext, async () => {
      try {
        const result = await getClient().get("/globalFeatureFlags");
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_get_flag",
    {
      title: "Get Feature Flag",
      description: "Get a single feature flag by key (no specific scope required).",
      inputSchema: {
        key: z.string().min(1).max(200).regex(/^[\w-]+(?:\.[\w-]+)*$/).describe("Feature flag key"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_get_flag", getContext, async ({ key }) => {
      try {
        const result = await getClient().get(`/globalFeatureFlags/${key}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
