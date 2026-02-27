import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { handleApiError } from "../services/error-handler.js";

export function registerMessageTools(server: McpServer, getClient: () => ElnoraApiClient): void {
  server.registerTool(
    "elnora_send_message",
    {
      title: "Send Message",
      description:
        "Send a message to an Elnora task and receive the AI response. The message is processed by Elnora's AI system, which handles protocol generation, research, and data analysis. This operation may take 30-120 seconds for complex requests.",
      inputSchema: {
        task_id: z.string().uuid().describe("Task UUID"),
        message: z.string().min(1).max(10000).describe("Message content (markdown supported)"),
        file_ids: z.array(z.string().uuid()).optional().describe("File IDs to attach"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ task_id, message, file_ids }) => {
      try {
        const response = await getClient().sendMessage(task_id, message, file_ids);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    },
  );
}
