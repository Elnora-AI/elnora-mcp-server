import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";
import { OUTPUT_OPTIONS_SCHEMA } from "../services/response-formatter.js";

export function registerFolderTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_folders_roots",
    {
      title: "elnora_folders_roots",
      description: "List the top-level Knowledge Base folders you can access",
      inputSchema: {
        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_folders_roots", getContext, async () => {
      try {
        const result = await getClient().get("/folders/roots");
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_folders_children",
    {
      title: "elnora_folders_children",
      description: "List the child folders of a Knowledge Base folder",
      inputSchema: {
        folderId: z.string().uuid().describe("Folder UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_folders_children", getContext, async ({ folderId }) => {
      try {
        const result = await getClient().get(`/folders/${folderId}/children`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_folders_get",
    {
      title: "elnora_folders_get",
      description: "Get a Knowledge Base folder's details and breadcrumb path",
      inputSchema: {
        folderId: z.string().uuid().describe("Folder UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_folders_get", getContext, async ({ folderId }) => {
      try {
        const result = await getClient().get(`/folders/${folderId}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_folders_files",
    {
      title: "elnora_folders_files",
      description: "List files placed directly in a Knowledge Base folder",
      inputSchema: {
        folderId: z.string().uuid().describe("Folder UUID"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        pageSize: z.number().int().min(1).max(100).default(25).describe("Results per page"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_folders_files", getContext, async ({ folderId, page, pageSize }) => {
      try {
        const result = await getClient().get(`/folders/${folderId}/files`, { page, pageSize });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_folders_list",
    {
      title: "elnora_folders_list",
      description: "List folders in a project",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_folders_list", getContext, async ({ projectId }) => {
      try {
        const result = await getClient().get(`/projects/${projectId}/folders`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_folders_create",
    {
      title: "elnora_folders_create",
      description: "Create a new folder in a project",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        name: z.string().min(1).max(255).describe("Folder name"),
        parentId: z.string().uuid().optional().describe("Parent folder UUID for nesting"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_folders_create", getContext, async ({ projectId, name, parentId }) => {
      try {
        const result = await getClient().post(`/projects/${projectId}/folders`, { name, parentId });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_folders_rename",
    {
      title: "elnora_folders_rename",
      description: "Rename a folder",
      inputSchema: {
        folderId: z.string().uuid().describe("Folder UUID"),
        name: z.string().min(1).max(255).describe("New name"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_folders_rename", getContext, async ({ folderId, name }) => {
      try {
        const result = await getClient().put(`/folders/${folderId}`, { name });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_folders_move",
    {
      title: "elnora_folders_move",
      description: "Move a folder to a new parent (or to root)",
      inputSchema: {
        folderId: z.string().uuid().describe("Folder UUID"),
        parentId: z.string().uuid().optional().describe("New parent folder UUID (omit for root)"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_folders_move", getContext, async ({ folderId, parentId }) => {
      try {
        const result = await getClient().put(`/folders/${folderId}/move`, { parentId: parentId ?? null });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_folders_delete",
    {
      title: "elnora_folders_delete",
      description: "Delete a folder",
      inputSchema: {
        folderId: z.string().uuid().describe("Folder UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_folders_delete", getContext, async ({ folderId }) => {
      try {
        await getClient().del(`/folders/${folderId}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, folderId }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_folders_share",
    {
      title: "elnora_folders_share",
      description: "Share a folder with a user or the whole organization (default role: editor)",
      inputSchema: {
        folderId: z.string().uuid().describe("Folder ID to share"),
        userId: z.number().int().positive().optional().describe("User ID to share with (omit when using orgWide)"),
        orgWide: z.boolean().default(false).describe("Share with everyone in the organization"),
        role: z.enum(["viewer", "editor", "admin"]).default("editor").describe("Access role to grant"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_folders_share", getContext, async ({ folderId, userId, orgWide, role }) => {
      try {
        // Exactly one principal: a specific user OR the whole org (teams are not available yet).
        if (orgWide === (userId !== undefined)) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: "Specify exactly one recipient: either userId or orgWide." }),
              },
            ],
            isError: true,
          };
        }
        const body = orgWide ? { isOrgWide: true, role } : { userId, role };
        const result = await getClient().post(`/folders/${folderId}/share`, body);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_folders_unshare",
    {
      title: "elnora_folders_unshare",
      description: "Revoke a folder share by its ACE id",
      inputSchema: {
        folderId: z.string().uuid().describe("Folder ID"),
        aceId: z.string().uuid().describe("Share (ACE) ID to revoke"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_folders_unshare", getContext, async ({ folderId, aceId }) => {
      try {
        await getClient().del(`/folders/${folderId}/share/${aceId}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ revoked: true, folderId, aceId }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_folders_shares",
    {
      title: "elnora_folders_shares",
      description: "List the current shares on a folder",
      inputSchema: {
        folderId: z.string().uuid().describe("Folder ID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_folders_shares", getContext, async ({ folderId }) => {
      try {
        const result = await getClient().get(`/folders/${folderId}/shares`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
