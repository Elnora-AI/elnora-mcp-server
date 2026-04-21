import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";
import { OUTPUT_OPTIONS_SCHEMA } from "../services/response-formatter.js";

/**
 * Tasks tools (also includes messaging and fetching messages for a task,
 * matching the CLI `tasks.send` and `tasks.messages` commands).
 *
 * `stream` and `wait` flags exist for CLI TTY parity but are no-ops over
 * MCP: the handler always awaits the server response synchronously.
 */
export function registerTaskTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_tasks_list",
    {
      title: "elnora_tasks_list",
      description: "List tasks, optionally filtered by project",
      inputSchema: {
        project: z.string().uuid().optional().describe("Filter by project UUID"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        pageSize: z.number().int().min(1).max(100).default(25).describe("Results per page"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_tasks_list", getContext, async ({ project, page, pageSize }) => {
      try {
        const path = project ? `/projects/${project}/tasks` : "/tasks";
        const result = await getClient().get(path, { page, pageSize });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_tasks_get",
    {
      title: "elnora_tasks_get",
      description: "Get details of a specific task",
      inputSchema: {
        taskId: z.string().uuid().describe("Task UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_tasks_get", getContext, async ({ taskId }) => {
      try {
        const result = await getClient().get(`/tasks/${taskId}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_tasks_create",
    {
      title: "elnora_tasks_create",
      description: "Create a new task in a project",
      inputSchema: {
        project: z.string().uuid().describe("Project UUID"),
        title: z.string().max(200).optional().describe("Task title"),
        message: z.string().max(50_000).optional().describe("Initial message"),
        wait: z.boolean().optional().describe("CLI-only: wait for agent response (no-op over MCP)"),
        stream: z.boolean().optional().describe("CLI-only: stream agent response (no-op over MCP)"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_tasks_create", getContext, async ({ project, title, message }) => {
      try {
        const client = getClient();
        const body: Record<string, unknown> = { projectId: project, title: title || "New Task" };
        if (message) body.initialMessage = message;
        const task = await client.post<{ id: string }>("/tasks", body);

        // Two-step: create then send initial message if provided.
        if (message && task?.id) {
          try {
            const response = await client.sendMessage(task.id, message);
            return { content: [{ type: "text" as const, text: JSON.stringify({ ...task, initialResponse: response }) }] };
          } catch (msgError) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({
                error: `Task created but initial message failed: ${msgError instanceof Error ? msgError.message : String(msgError)}. Retry with elnora_tasks_send.`,
                taskId: task.id,
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
    "elnora_tasks_send",
    {
      title: "elnora_tasks_send",
      description: "Send a message to a task",
      inputSchema: {
        taskId: z.string().uuid().describe("Task UUID"),
        message: z.string().min(1).max(50_000).describe("Message content (markdown supported)"),
        fileRefs: z.array(z.string().uuid()).optional().describe("File IDs to attach"),
        wait: z.boolean().optional().describe("CLI-only: wait for agent response (no-op over MCP)"),
        stream: z.boolean().optional().describe("CLI-only: stream agent response (no-op over MCP)"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_tasks_send", getContext, async ({ taskId, message, fileRefs }) => {
      try {
        const response = await getClient().sendMessage(taskId, message, fileRefs);
        return { content: [{ type: "text" as const, text: JSON.stringify(response) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_tasks_messages",
    {
      title: "elnora_tasks_messages",
      description: "List messages for a task",
      inputSchema: {
        taskId: z.string().uuid().describe("Task UUID"),
        limit: z.number().int().min(1).max(100).default(50).describe("Max messages"),
        cursor: z.string().optional().describe("Cursor for pagination"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_tasks_messages", getContext, async ({ taskId, limit, cursor }) => {
      try {
        const params: Record<string, string | number | undefined> = { limit };
        if (cursor) params.cursor = cursor;
        const result = await getClient().get(`/tasks/${taskId}/messages`, params);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_tasks_update",
    {
      title: "elnora_tasks_update",
      description: "Update an existing task",
      inputSchema: {
        taskId: z.string().uuid().describe("Task UUID"),
        title: z.string().max(200).optional().describe("New title"),
        status: z.string().optional().describe("New status"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_tasks_update", getContext, async ({ taskId, title, status }) => {
      try {
        const body: Record<string, string> = {};
        if (title !== undefined) body.title = title;
        if (status !== undefined) body.status = status;
        if (Object.keys(body).length === 0) {
          return { content: [{ type: "text" as const, text: "Error: At least one field (title or status) must be provided." }], isError: true };
        }
        const result = await getClient().put(`/tasks/${taskId}`, body);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_tasks_archive",
    {
      title: "elnora_tasks_archive",
      description: "Archive (delete) a task",
      inputSchema: {
        taskId: z.string().uuid().describe("Task UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_tasks_archive", getContext, async ({ taskId }) => {
      try {
        await getClient().del(`/tasks/${taskId}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ archived: true, taskId }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
