import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";
import { OUTPUT_OPTIONS_SCHEMA } from "../services/response-formatter.js";
import { logToolInvocation } from "../middleware/tool-logging.js";

/**
 * Aggregate tool — creates a task and sends the description in one call.
 * Mirrors the `protocols.generate` CLI command so both surfaces stay aligned.
 */
export function registerProtocolTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_protocols_generate",
    {
      title: "elnora_protocols_generate",
      description: "Generate a bioprotocol — creates a task and sends the description in one call",
      inputSchema: {
        description: z.string().min(10).max(5000).describe("Protocol description"),
        title: z.string().max(200).optional().describe("Task title (defaults to first 100 chars of description)"),
        project: z.string().uuid().optional().describe("Project UUID to associate with"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_protocols_generate", getContext, async ({ description, title, project }) => {
      try {
        const client = getClient();
        const ctx = getContext();
        const body: Record<string, unknown> = { title: title || description.slice(0, 100) };
        if (project) body.projectId = project;
        const task = await client.post<{ id: string }>("/tasks", body);
        if (!task?.id) {
          return { content: [{ type: "text" as const, text: "Error: Task creation returned no ID." }], isError: true };
        }
        const msgStart = Date.now();
        let response: unknown;
        try {
          response = await client.sendMessage(task.id, description);
        } catch (msgError) {
          logToolInvocation("elnora_protocols_generate:send_message", { taskId: task.id }, ctx.clientId, {
            success: false,
            durationMs: Date.now() - msgStart,
          });
          return {
            content: [{ type: "text" as const, text: JSON.stringify({
              error: `Task created but message failed: ${msgError instanceof Error ? msgError.message : String(msgError)}. Retry with elnora_tasks_send.`,
              taskId: task.id,
            }) }],
            isError: true,
          };
        }
        logToolInvocation("elnora_protocols_generate:send_message", { taskId: task.id }, ctx.clientId, {
          success: true,
          durationMs: Date.now() - msgStart,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ taskId: task.id, response }) }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
