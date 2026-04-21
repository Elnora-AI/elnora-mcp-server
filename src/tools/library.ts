import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";
import { OUTPUT_OPTIONS_SCHEMA } from "../services/response-formatter.js";

export function registerLibraryTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_library_files",
    {
      title: "elnora_library_files",
      description: "List files in the organization library",
      inputSchema: {
        orgId: z.string().uuid().describe("Organization UUID"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        pageSize: z.number().int().min(1).max(100).default(25).describe("Results per page"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_library_files", getContext, async ({ orgId, page, pageSize }) => {
      try {
        const result = await getClient().get(`/organizations/${orgId}/library/files`, { page, pageSize });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_library_folders",
    {
      title: "elnora_library_folders",
      description: "List folders in the organization library",
      inputSchema: {
        orgId: z.string().uuid().describe("Organization UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_library_folders", getContext, async ({ orgId }) => {
      try {
        const result = await getClient().get(`/organizations/${orgId}/library/folders`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_library_createFolder",
    {
      title: "elnora_library_createFolder",
      description: "Create a folder in the organization library",
      inputSchema: {
        orgId: z.string().uuid().describe("Organization ID"),
        name: z.string().min(1).describe("Folder name"),
        parent: z.string().uuid().optional().describe("Parent folder ID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_library_createFolder", getContext, async ({ orgId, name, parent }) => {
      try {
        const body: Record<string, string> = { name };
        if (parent) body.parentId = parent;
        const result = await getClient().post(`/organizations/${orgId}/library/folders`, body);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_library_renameFolder",
    {
      title: "elnora_library_renameFolder",
      description: "Rename a folder in the organization library",
      inputSchema: {
        orgId: z.string().uuid().describe("Organization UUID"),
        folderId: z.string().uuid().describe("Folder UUID"),
        name: z.string().min(1).max(255).describe("New name"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_library_renameFolder", getContext, async ({ orgId, folderId, name }) => {
      try {
        const result = await getClient().put(`/organizations/${orgId}/library/folders/${folderId}`, { name });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_library_deleteFolder",
    {
      title: "elnora_library_deleteFolder",
      description: "Delete a folder from the organization library",
      inputSchema: {
        orgId: z.string().uuid().describe("Organization UUID"),
        folderId: z.string().uuid().describe("Folder UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_library_deleteFolder", getContext, async ({ orgId, folderId }) => {
      try {
        await getClient().del(`/organizations/${orgId}/library/folders/${folderId}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, folderId }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
