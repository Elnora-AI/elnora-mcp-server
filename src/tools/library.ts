import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";

export function registerLibraryTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_list_library_files",
    {
      title: "List Library Files",
      description: "List files in the organization shared library.",
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        page_size: z.number().int().min(1).max(100).default(25).describe("Results per page"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_list_library_files", getContext, async ({ org_id, page, page_size }) => {
      try {
        const result = await getClient().get(`/organizations/${org_id}/library/files`, { page, pageSize: page_size });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_list_library_folders",
    {
      title: "List Library Folders",
      description: "List folders in the organization shared library.",
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_list_library_folders", getContext, async ({ org_id }) => {
      try {
        const result = await getClient().get(`/organizations/${org_id}/library/folders`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_create_library_folder",
    {
      title: "Create Library Folder",
      description: "Create a folder in the organization shared library.",
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
        name: z.string().min(1).max(255).describe("Folder name"),
        parent_id: z.string().uuid().optional().describe("Parent folder UUID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_create_library_folder", getContext, async ({ org_id, name, parent_id }) => {
      try {
        const result = await getClient().post(`/organizations/${org_id}/library/folders`, { name, parentId: parent_id });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_rename_library_folder",
    {
      title: "Rename Library Folder",
      description: "Rename a folder in the organization shared library.",
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
        folder_id: z.string().uuid().describe("Folder UUID"),
        name: z.string().min(1).max(255).describe("New name"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_rename_library_folder", getContext, async ({ org_id, folder_id, name }) => {
      try {
        const result = await getClient().put(`/organizations/${org_id}/library/folders/${folder_id}`, { name });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_delete_library_folder",
    {
      title: "Delete Library Folder",
      description: "Delete a folder from the organization shared library.",
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
        folder_id: z.string().uuid().describe("Folder UUID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_delete_library_folder", getContext, async ({ org_id, folder_id }) => {
      try {
        await getClient().del(`/organizations/${org_id}/library/folders/${folder_id}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, folderId: folder_id }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
