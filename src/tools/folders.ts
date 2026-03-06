import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";

export function registerFolderTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_list_folders",
    {
      title: "List Folders",
      description: "List folders in a project.",
      inputSchema: {
        project_id: z.string().uuid().describe("Project UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_list_folders", getContext, async ({ project_id }) => {
      try {
        const result = await getClient().get(`/projects/${project_id}/folders`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_create_folder",
    {
      title: "Create Folder",
      description: "Create a folder in a project.",
      inputSchema: {
        project_id: z.string().uuid().describe("Project UUID"),
        name: z.string().min(1).max(255).describe("Folder name"),
        parent_id: z.string().uuid().optional().describe("Parent folder UUID for nesting"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_create_folder", getContext, async ({ project_id, name, parent_id }) => {
      try {
        const result = await getClient().post(`/projects/${project_id}/folders`, { name, parentId: parent_id });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_rename_folder",
    {
      title: "Rename Folder",
      description: "Rename a folder.",
      inputSchema: {
        folder_id: z.string().uuid().describe("Folder UUID"),
        name: z.string().min(1).max(255).describe("New name"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_rename_folder", getContext, async ({ folder_id, name }) => {
      try {
        const result = await getClient().put(`/folders/${folder_id}`, { name });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_move_folder",
    {
      title: "Move Folder",
      description: "Move a folder to a new parent (null for root).",
      inputSchema: {
        folder_id: z.string().uuid().describe("Folder UUID"),
        parent_id: z.string().uuid().optional().describe("New parent folder UUID (omit for root)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_move_folder", getContext, async ({ folder_id, parent_id }) => {
      try {
        const result = await getClient().put(`/folders/${folder_id}/move`, { parentId: parent_id ?? null });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_delete_folder",
    {
      title: "Delete Folder",
      description: "Delete a folder.",
      inputSchema: {
        folder_id: z.string().uuid().describe("Folder UUID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_delete_folder", getContext, async ({ folder_id }) => {
      try {
        await getClient().del(`/folders/${folder_id}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, folderId: folder_id }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
