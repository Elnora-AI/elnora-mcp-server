import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";
import { OUTPUT_OPTIONS_SCHEMA } from "../services/response-formatter.js";

export function registerProjectTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_projects_list",
    {
      title: "elnora_projects_list",
      description: "List all projects accessible to the current user",
      inputSchema: {
        page: z.number().int().min(1).default(1).describe("Page number"),
        pageSize: z.number().int().min(1).max(100).default(25).describe("Results per page"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_projects_list", getContext, async ({ page, pageSize }) => {
      try {
        const result = await getClient().get("/projects", { page, pageSize });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_projects_get",
    {
      title: "elnora_projects_get",
      description: "Get details of a specific project",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_projects_get", getContext, async ({ projectId }) => {
      try {
        const result = await getClient().get(`/projects/${projectId}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_projects_create",
    {
      title: "elnora_projects_create",
      description: "Create a new project",
      inputSchema: {
        name: z.string().min(1).max(200).describe("Project name"),
        description: z.string().max(2000).optional().describe("Project description"),
        icon: z.string().max(50).optional().describe("Project icon"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_projects_create", getContext, async ({ name, description, icon }) => {
      try {
        const result = await getClient().post("/projects", { name, description, icon });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_projects_update",
    {
      title: "elnora_projects_update",
      description: "Update an existing project",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        name: z.string().min(1).max(200).optional().describe("New name"),
        description: z.string().max(2000).optional().describe("New description"),
        icon: z.string().max(50).optional().describe("New icon"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_projects_update", getContext, async ({ projectId, name, description, icon }) => {
      try {
        const body: Record<string, string> = {};
        if (name !== undefined) body.name = name;
        if (description !== undefined) body.description = description;
        if (icon !== undefined) body.icon = icon;
        if (Object.keys(body).length === 0) {
          return { content: [{ type: "text" as const, text: "Error: At least one field (name, description, or icon) must be provided." }], isError: true };
        }
        const result = await getClient().put(`/projects/${projectId}`, body);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_projects_archive",
    {
      title: "elnora_projects_archive",
      description: "Archive (delete) a project",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_projects_archive", getContext, async ({ projectId }) => {
      try {
        await getClient().del(`/projects/${projectId}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ archived: true, projectId }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_projects_members",
    {
      title: "elnora_projects_members",
      description: "List members of a project",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_projects_members", getContext, async ({ projectId }) => {
      try {
        const result = await getClient().get(`/projects/${projectId}/members`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_projects_addMember",
    {
      title: "elnora_projects_addMember",
      description: "Add a member to a project",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        userId: z.string().min(1).max(255).describe("User ID to add"),
        role: z.string().max(100).default("Member").describe("Role (default: Member)"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_projects_addMember", getContext, async ({ projectId, userId, role }) => {
      try {
        const result = await getClient().post(`/projects/${projectId}/members`, { userId, role });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_projects_updateRole",
    {
      title: "elnora_projects_updateRole",
      description: "Update a project member's role",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        userId: z.string().min(1).max(255).describe("User ID"),
        role: z.string().min(1).max(100).describe("New role"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_projects_updateRole", getContext, async ({ projectId, userId, role }) => {
      try {
        const result = await getClient().put(`/projects/${projectId}/members/${userId}/role`, { role });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_projects_removeMember",
    {
      title: "elnora_projects_removeMember",
      description: "Remove a member from a project",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        userId: z.string().min(1).max(255).describe("User ID to remove"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_projects_removeMember", getContext, async ({ projectId, userId }) => {
      try {
        await getClient().del(`/projects/${projectId}/members/${userId}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ removed: true, userId }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_projects_leave",
    {
      title: "elnora_projects_leave",
      description: "Leave a project",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_projects_leave", getContext, async ({ projectId }) => {
      try {
        await getClient().post(`/projects/${projectId}/leave`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ left: true, projectId }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
