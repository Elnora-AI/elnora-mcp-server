import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";
import { OUTPUT_OPTIONS_SCHEMA } from "../services/response-formatter.js";

export function registerReviewTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_review_list",
    {
      title: "elnora_review_list",
      description: "List the Knowledge Base review queue (auto-tidy proposals awaiting approval)",
      inputSchema: {
        status: z.enum(["pending", "applied", "rejected", "all"]).default("pending").describe("Filter by review status ('all' lists every state)"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_review_list", getContext, async ({ status }) => {
      try {
        // The backend lists every state when status is empty; "all" maps to that.
        const result = await getClient().get(`/kb-review-items`, { status: status === "all" ? "" : status });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_review_approve",
    {
      title: "elnora_review_approve",
      description: "Approve a Knowledge Base review item, applying its proposed change",
      inputSchema: {
        itemId: z.string().uuid().describe("Review item ID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_review_approve", getContext, async ({ itemId }) => {
      try {
        const result = await getClient().post(`/kb-review-items/${itemId}/approve`, {});
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_review_reject",
    {
      title: "elnora_review_reject",
      description: "Reject a Knowledge Base review item without applying its change",
      inputSchema: {
        itemId: z.string().uuid().describe("Review item ID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_review_reject", getContext, async ({ itemId }) => {
      try {
        const result = await getClient().post(`/kb-review-items/${itemId}/reject`, {});
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
