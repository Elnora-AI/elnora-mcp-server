import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";

export function registerProtocolTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_generate_protocol",
    {
      title: "Generate Protocol",
      description: `Generate a bioprotocol using Elnora's AI agents. This is a convenience tool that creates a task, sends the description as a message, and returns the generated protocol content. This is the primary tool for hackathon partners. The operation typically takes 30-120 seconds.

Examples:
  - "Generate a HEK 293 cell maintenance protocol"
  - "Create a CRISPR guide RNA design protocol for BRCA1"
  - "Write a western blot protocol for detecting p53 in HeLa cells"`,
      inputSchema: {
        description: z.string().min(10).max(5000).describe("Protocol description"),
        title: z.string().max(200).optional().describe("Task title (defaults to description preview)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    withGuard("elnora_generate_protocol", getContext, async ({ description, title }) => {
      try {
        const client = getClient();

        // 1. Create a task
        const taskTitle = title || description.slice(0, 100);
        const task = await client.createTask(taskTitle);

        // 2. Send the description as a message
        const response = await client.sendMessage(task.id, description);

        // 3. Return the result
        const result = {
          task_id: task.id,
          protocol_content: response.content,
          message_id: response.id,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
