import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";
import { OUTPUT_OPTIONS_SCHEMA } from "../services/response-formatter.js";

export function registerFlagTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_flags_list",
    {
      title: "elnora_flags_list",
      description: "List all feature flags",
      inputSchema: {
        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_flags_list", getContext, async () => {
      try {
        const result = await getClient().get("/globalFeatureFlags");
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_flags_get",
    {
      title: "elnora_flags_get",
      description: "Get a feature flag by key",
      inputSchema: {
        key: z.string().min(1).max(200).regex(/^[\w-]+(?:\.[\w-]+)*$/).describe("Feature flag key"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_flags_get", getContext, async ({ key }) => {
      try {
        const result = await getClient().get(`/globalFeatureFlags/${key}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_flags_set",
    {
      title: "elnora_flags_set",
      description: "Set a feature flag value",
      inputSchema: {
        key: z.string().min(1).max(200).regex(/^[\w-]+(?:\.[\w-]+)*$/).describe("Feature flag key"),
        value: z.union([z.string(), z.boolean(), z.number()]).describe("Flag value"),
        yes: z.boolean().optional().describe("Skip confirmation"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_flags_set", getContext, async ({ key, value }) => {
      try {
        const result = await getClient().put(`/globalFeatureFlags/${key}`, { value });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
