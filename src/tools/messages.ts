import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";
import { OUTPUT_OPTIONS_SCHEMA } from "../services/response-formatter.js";

export function registerMessageTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_send_message",
    {
      title: "Send Message",
      description: "Send a message to a task and receive the AI response. May take 30-120s for complex requests.",
      inputSchema: {
        task_id: z.string().uuid().describe("Task UUID"),
        message: z.string().min(1).max(50_000).describe("Message content (markdown supported)"),
        file_ids: z.array(z.string().uuid()).optional().describe("File IDs to attach"),
        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_send_message", getContext, async ({ task_id, message, file_ids }) => {
      try {
        const response = await getClient().sendMessage(task_id, message, file_ids);
        return { content: [{ type: "text" as const, text: JSON.stringify(response) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
