import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";
import { OUTPUT_OPTIONS_SCHEMA } from "../services/response-formatter.js";

export function registerAuditTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_list_audit_log",
    {
      title: "List Audit Log",
      description: "List organization audit log entries. Filterable by action and user.",
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        page_size: z.number().int().min(1).max(100).default(25).describe("Results per page"),
        action: z.string().min(1).max(200).optional().describe("Filter by action type"),
        user_id: z.string().min(1).optional().describe("Filter by user ID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_list_audit_log", getContext, async ({ org_id, page, page_size, action, user_id }) => {
      try {
        const result = await getClient().get(`/organizations/${org_id}/audit-log`, {
          page, pageSize: page_size, action, userId: user_id,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
