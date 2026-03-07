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
      description: "Create a new task (conversation thread). Each task is a chat where you send messages and receive AI responses.",
      inputSchema: {
        org_id: z.string().uuid().optional().describe("Organization UUID (optional, defaults to active org)"),
        project_id: z.string().uuid().optional().describe("Project UUID (optional)"),
        title: z.string().max(200).optional().describe("Task title"),
        initial_message: z.string().max(50_000).optional().describe("Initial message to send"),
        context_file_ids: z.array(z.string().uuid()).optional().describe("File IDs for context"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_create_task", getContext, async ({ org_id, project_id, title, initial_message, context_file_ids }) => {
      try {
        const client = getClient();
        if (org_id) client.setOrgContext(org_id);
        const body: Record<string, unknown> = { title: title || "New Task" };
        if (project_id) body.projectId = project_id;
        if (context_file_ids) body.contextFileIds = context_file_ids;
        const task = await client.post<{ id: string }>("/tasks", body);

        // Two-step: create task then send initial message (API does not accept initialMessage in POST /tasks)
        if (initial_message && task?.id) {
          try {
            const response = await client.sendMessage(task.id, initial_message);
            return { content: [{ type: "text" as const, text: JSON.stringify({ ...task, initial_response: response }) }] };
          } catch (msgError) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({
                error: `Task created but initial message failed: ${msgError instanceof Error ? msgError.message : String(msgError)}. Retry with elnora_send_message.`,
                task_id: task.id,
              }) }],
              isError: true,
            };
          }
        }

        return { content: [{ type: "text" as const, text: JSON.stringify(task) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_list_tasks",
    {
      title: "List Tasks",
      description: "List tasks. Optionally filter by project or status.",
      inputSchema: {
        org_id: z.string().uuid().optional().describe("Organization UUID (optional, defaults to active org)"),
        project_id: z.string().uuid().optional().describe("Filter by project UUID"),
        status: z.string().optional().describe("Filter by status"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        page_size: z.number().int().min(1).max(100).default(25).describe("Results per page"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_list_tasks", getContext, async ({ org_id, project_id, status, page, page_size }) => {
      try {
        const client = getClient();
        if (org_id) client.setOrgContext(org_id);
        const path = project_id ? `/projects/${project_id}/tasks` : "/tasks";
        const result = await client.get(path, { page, pageSize: page_size, status });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_get_task",
    {
      title: "Get Task",
      description: "Get a single task by UUID.",
      inputSchema: {
        task_id: z.string().uuid().describe("Task UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_get_task", getContext, async ({ task_id }) => {
      try {
        const result = await getClient().get(`/tasks/${task_id}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_get_task_messages",
    {
      title: "Get Task Messages",
      description: "Get message history for a task.",
      inputSchema: {
        task_id: z.string().uuid().describe("Task UUID"),
        limit: z.number().int().min(1).max(100).default(50).describe("Max messages"),
        cursor: z.string().optional().describe("Cursor for pagination"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_get_task_messages", getContext, async ({ task_id, limit, cursor }) => {
      try {
        const params: Record<string, string | number | undefined> = { limit };
        if (cursor) params.cursor = cursor;
        const result = await getClient().get(`/tasks/${task_id}/messages`, params);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_update_task",
    {
      title: "Update Task",
      description: "Update task title or status.",
      inputSchema: {
        task_id: z.string().uuid().describe("Task UUID"),
        title: z.string().max(200).optional().describe("New title"),
        status: z.string().optional().describe("New status"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_update_task", getContext, async ({ task_id, title, status }) => {
      try {
        const body: Record<string, string> = {};
        if (title !== undefined) body.title = title;
        if (status !== undefined) body.status = status;
        if (Object.keys(body).length === 0) {
          return { content: [{ type: "text" as const, text: "Error: At least one field (title or status) must be provided." }], isError: true };
        }
        const result = await getClient().put(`/tasks/${task_id}`, body);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_archive_task",
    {
      title: "Archive Task",
      description: "Archive (delete) a task.",
      inputSchema: {
        task_id: z.string().uuid().describe("Task UUID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_archive_task", getContext, async ({ task_id }) => {
      try {
        await getClient().del(`/tasks/${task_id}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ archived: true, taskId: task_id }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
