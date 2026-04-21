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
}
