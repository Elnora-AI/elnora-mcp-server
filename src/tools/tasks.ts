import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";

export function registerTaskTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_create_task",
    {
      title: "Create Task",
      description:
        "Create a new task (conversation) in Elnora. Tasks are the primary unit of interaction — each task is a chat thread where you can send messages and receive AI agent responses.",
      inputSchema: {
        title: z.string().max(200).optional().describe("Task title (e.g., 'HEK 293 protocol generation')"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    withGuard("elnora_create_task", getContext, async ({ title }) => {
      try {
        const task = await getClient().createTask(title);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_list_tasks",
    {
      title: "List Tasks",
      description:
        "List tasks in your Elnora workspace. Returns task summaries with status and timestamps.",
      inputSchema: {
        status: z.string().optional().describe("Filter by task status"),
        limit: z.number().int().min(1).max(100).default(20).describe("Max results"),
        offset: z.number().int().min(0).default(0).describe("Pagination offset"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_list_tasks", getContext, async ({ status, limit, offset }) => {
      try {
        const result = await getClient().listTasks(status, limit, offset);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_get_task_messages",
    {
      title: "Get Task Messages",
      description:
        "Get the message history for a specific task. Returns user and assistant messages in chronological order.",
      inputSchema: {
        task_id: z.string().uuid().describe("Task UUID"),
        limit: z.number().int().min(1).max(100).default(50).describe("Max messages"),
        offset: z.number().int().min(0).default(0).describe("Pagination offset"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_get_task_messages", getContext, async ({ task_id, limit, offset }) => {
      try {
        const result = await getClient().getTaskMessages(task_id, limit, offset);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
