import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";

export function registerProjectTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_list_projects",
    {
      title: "List Projects",
      description: "List all projects. Returns paginated project summaries.",
      inputSchema: {
        org_id: z.string().uuid().optional().describe("Organization UUID (optional, defaults to active org)"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        page_size: z.number().int().min(1).max(100).default(25).describe("Results per page"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_list_projects", getContext, async ({ org_id, page, page_size }) => {
      try {
        const client = getClient();
        if (org_id) client.setOrgContext(org_id);
        const result = await client.get("/projects", { page, pageSize: page_size });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_get_project",
    {
      title: "Get Project",
      description: "Get a single project by UUID.",
      inputSchema: {
        project_id: z.string().uuid().describe("Project UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_get_project", getContext, async ({ project_id }) => {
      try {
        const result = await getClient().get(`/projects/${project_id}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_create_project",
    {
      title: "Create Project",
      description: "Create a new project.",
      inputSchema: {
        org_id: z.string().uuid().optional().describe("Organization UUID (optional, defaults to active org)"),
        name: z.string().min(1).max(200).describe("Project name"),
        description: z.string().max(2000).optional().describe("Project description"),
        icon: z.string().max(50).optional().describe("Project icon"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_create_project", getContext, async ({ org_id, name, description, icon }) => {
      try {
        const client = getClient();
        if (org_id) client.setOrgContext(org_id);
        const result = await client.post("/projects", { name, description, icon });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_update_project",
    {
      title: "Update Project",
      description: "Update project metadata (name, description, icon).",
      inputSchema: {
        project_id: z.string().uuid().describe("Project UUID"),
        name: z.string().min(1).max(200).optional().describe("New name"),
        description: z.string().max(2000).optional().describe("New description"),
        icon: z.string().max(50).optional().describe("New icon"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_update_project", getContext, async ({ project_id, name, description, icon }) => {
      try {
        const body: Record<string, string> = {};
        if (name !== undefined) body.name = name;
        if (description !== undefined) body.description = description;
        if (icon !== undefined) body.icon = icon;
        if (Object.keys(body).length === 0) {
          return { content: [{ type: "text" as const, text: "Error: At least one field (name, description, or icon) must be provided." }], isError: true };
        }
        const result = await getClient().put(`/projects/${project_id}`, body);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_archive_project",
    {
      title: "Archive Project",
      description: "Archive (soft-delete) a project.",
      inputSchema: {
        project_id: z.string().uuid().describe("Project UUID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_archive_project", getContext, async ({ project_id }) => {
      try {
        await getClient().del(`/projects/${project_id}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ archived: true, projectId: project_id }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_list_project_members",
    {
      title: "List Project Members",
      description: "List members of a project.",
      inputSchema: {
        project_id: z.string().uuid().describe("Project UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_list_project_members", getContext, async ({ project_id }) => {
      try {
        const result = await getClient().get(`/projects/${project_id}/members`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_add_project_member",
    {
      title: "Add Project Member",
      description: "Add a user to a project.",
      inputSchema: {
        project_id: z.string().uuid().describe("Project UUID"),
        user_id: z.string().min(1).max(255).describe("User ID to add"),
        role: z.string().max(100).default("Member").describe("Role (default: Member)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_add_project_member", getContext, async ({ project_id, user_id, role }) => {
      try {
        const result = await getClient().post(`/projects/${project_id}/members`, { userId: user_id, role });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_update_project_member_role",
    {
      title: "Update Project Member Role",
      description: "Change a project member's role.",
      inputSchema: {
        project_id: z.string().uuid().describe("Project UUID"),
        user_id: z.string().min(1).max(255).describe("User ID"),
        role: z.string().min(1).max(100).describe("New role"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_update_project_member_role", getContext, async ({ project_id, user_id, role }) => {
      try {
        const result = await getClient().put(`/projects/${project_id}/members/${user_id}/role`, { role });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_remove_project_member",
    {
      title: "Remove Project Member",
      description: "Remove a user from a project.",
      inputSchema: {
        project_id: z.string().uuid().describe("Project UUID"),
        user_id: z.string().min(1).max(255).describe("User ID to remove"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_remove_project_member", getContext, async ({ project_id, user_id }) => {
      try {
        await getClient().del(`/projects/${project_id}/members/${user_id}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ removed: true, userId: user_id }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_leave_project",
    {
      title: "Leave Project",
      description: "Leave a project you are a member of.",
      inputSchema: {
        project_id: z.string().uuid().describe("Project UUID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_leave_project", getContext, async ({ project_id }) => {
      try {
        await getClient().post(`/projects/${project_id}/leave`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ left: true, projectId: project_id }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
