import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";
import { LONG_REQUEST_TIMEOUT_MS } from "../constants.js";

export function registerProtocolTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_generate_protocol",
    {
      title: "Generate Protocol",
      description: "Generate a bioprotocol using Elnora AI. Creates a task, sends the description, and returns the result. Takes 30-120s.",
      inputSchema: {
        description: z.string().min(10).max(5000).describe("Protocol description"),
        title: z.string().max(200).optional().describe("Task title"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_generate_protocol", getContext, async ({ description, title }) => {
      try {
        const client = getClient();
        const task = await client.post<{ id: string }>("/tasks", { title: title || description.slice(0, 100) }, { timeout: LONG_REQUEST_TIMEOUT_MS });
        const response = await client.sendMessage(task.id, description);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            task_id: task.id,
            response,
          }) }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
