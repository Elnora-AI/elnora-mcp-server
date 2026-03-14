import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";
import { OUTPUT_OPTIONS_SCHEMA } from "../services/response-formatter.js";
import { logToolInvocation } from "../middleware/tool-logging.js";

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
        project_id: z.string().uuid().optional().describe("Project UUID to associate the protocol task with"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_generate_protocol", getContext, async ({ description, title, project_id }) => {
      try {
        const client = getClient();
        const ctx = getContext();
        const body: Record<string, unknown> = { title: title || description.slice(0, 100) };
        if (project_id) body.projectId = project_id;
        const task = await client.post<{ id: string }>("/tasks", body);
        if (!task?.id) {
          return { content: [{ type: "text" as const, text: "Error: Task creation returned no ID." }], isError: true };
        }
        const msgStart = Date.now();
        let response: unknown;
        try {
          response = await client.sendMessage(task.id, description);
        } catch (msgError) {
          // Task was created but message failed — return task_id so caller can retry with elnora_send_message
          logToolInvocation("elnora_generate_protocol:send_message", { task_id: task.id, content: description }, ctx.clientId, {
            success: false,
            durationMs: Date.now() - msgStart,
          });
          return {
            content: [{ type: "text" as const, text: JSON.stringify({
              error: `Task created but message failed: ${msgError instanceof Error ? msgError.message : String(msgError)}. Retry with elnora_send_message.`,
              task_id: task.id,
            }) }],
            isError: true,
          };
        }
        // Log the implicit message send as a separate audit event (CoSAI MCP-T12)
        logToolInvocation("elnora_generate_protocol:send_message", { task_id: task.id, content: description }, ctx.clientId, {
          success: true,
          durationMs: Date.now() - msgStart,
        });
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
