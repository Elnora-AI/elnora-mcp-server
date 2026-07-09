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
    "elnora_audit_list",
    {
      title: "elnora_audit_list",
      description: "List audit log entries for an organization",
      inputSchema: {
        orgId: z.string().uuid().describe("Organization UUID"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        pageSize: z.number().int().min(1).max(100).default(25).describe("Results per page"),
        action: z.string().min(1).max(200).optional().describe("Filter by action type"),
        userId: z.string().min(1).optional().describe("Filter by user ID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_audit_list", getContext, async ({ orgId, page, pageSize, action, userId }) => {
      try {
        const result = await getClient().get(`/organizations/${orgId}/audit-log`, {
          page, pageSize, action, userId,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
