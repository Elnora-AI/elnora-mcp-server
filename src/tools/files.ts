import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";
import { CHARACTER_LIMIT } from "../constants.js";
import { OUTPUT_OPTIONS_SCHEMA } from "../services/response-formatter.js";

/**
 * File tools — names and params aligned with CLI `files.*` commands.
 *
 * CLI-specific upload flow (`files.upload` with `filePath`, `files.uploadBatch`)
 * is exposed in the MCP schema for symmetry but returns an error when invoked
 * remotely — the MCP server cannot read the client's local filesystem. Use
 * `elnora_files_createVersion` (content-based) instead from MCP clients.
 */
export function registerFileTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_files_list",
    {
      title: "elnora_files_list",
      description: "List files in a project",
      inputSchema: {
        project: z.string().uuid().describe("Project UUID"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        pageSize: z.number().int().min(1).max(100).default(25).describe("Results per page"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_files_list", getContext, async ({ project, page, pageSize }) => {
      try {
        const result = await getClient().get(`/projects/${project}/files`, { page, pageSize });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_files_get",
    {
      title: "elnora_files_get",
      description: "Get details of a specific file",
      inputSchema: {
        fileId: z.string().uuid().describe("File UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_files_get", getContext, async ({ fileId }) => {
      try {
        const result = await getClient().get(`/files/${fileId}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_files_content",
    {
      title: "elnora_files_content",
      description: "Get the raw content of a file",
      inputSchema: {
        fileId: z.string().uuid().describe("File UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_files_content", getContext, async ({ fileId }) => {
      try {
        const result = await getClient().getFileContent(fileId);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_files_create",
    {
      title: "elnora_files_create",
      description: "Create a new file",
      inputSchema: {
        project: z.string().uuid().describe("Project UUID"),
        name: z.string().min(1).max(255).describe("Filename"),
        folder: z.string().uuid().optional().describe("Folder UUID"),
        type: z.string().optional().describe("File type"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_files_create", getContext, async ({ project, name, folder, type }) => {
      try {
        const result = await getClient().post("/files", {
          projectId: project, name, folderId: folder, fileType: type,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_files_upload",
    {
      title: "elnora_files_upload",
      description: "Upload a file to a project (three-stage: presign, PUT, confirm)",
      inputSchema: {
        project: z.string().uuid().describe("Project UUID"),
        filePath: z.string().min(1).describe("Local file path (CLI only)"),
        fileName: z.string().optional().describe("Override filename"),
        contentType: z.string().optional().describe("MIME type"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_files_upload", getContext, async () => {
      return {
        content: [{
          type: "text" as const,
          text: "Error: elnora_files_upload requires local filesystem access and is unavailable over MCP. Use elnora_files_create + elnora_files_createVersion (content-based) or elnora_files_confirmUpload with a separately-uploaded presigned URL.",
        }],
        isError: true,
      };
    }),
  );

  server.registerTool(
    "elnora_files_uploadBatch",
    {
      title: "elnora_files_uploadBatch",
      description: "Upload multiple files to a project (max 50)",
      inputSchema: {
        project: z.string().uuid().describe("Project UUID"),
        filePaths: z.array(z.string().min(1)).max(50).describe("Local file paths (CLI only)"),
        folder: z.string().uuid().optional().describe("Folder UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_files_uploadBatch", getContext, async () => {
      return {
        content: [{
          type: "text" as const,
          text: "Error: elnora_files_uploadBatch requires local filesystem access and is unavailable over MCP.",
        }],
        isError: true,
      };
    }),
  );

  server.registerTool(
    "elnora_files_confirmUpload",
    {
      title: "elnora_files_confirmUpload",
      description: "Confirm a file upload",
      inputSchema: {
        fileId: z.string().uuid().describe("File UUID from upload initiation"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_files_confirmUpload", getContext, async ({ fileId }) => {
      try {
        const result = await getClient().post(`/files/${fileId}/upload/confirm`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_files_download",
    {
      title: "elnora_files_download",
      description: "Download a file",
      inputSchema: {
        fileId: z.string().uuid().describe("File UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_files_download", getContext, async ({ fileId }) => {
      try {
        const result = await getClient().get(`/files/${fileId}/download`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_files_update",
    {
      title: "elnora_files_update",
      description: "Update a file's metadata",
      inputSchema: {
        fileId: z.string().uuid().describe("File UUID"),
        name: z.string().min(1).max(255).optional().describe("New name"),
        folder: z.string().uuid().optional().describe("New folder UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_files_update", getContext, async ({ fileId, name, folder }) => {
      try {
        const body: Record<string, string> = {};
        if (name !== undefined) body.name = name;
        if (folder !== undefined) body.folderId = folder;
        if (Object.keys(body).length === 0) {
          return { content: [{ type: "text" as const, text: "Error: At least one field (name or folder) must be provided." }], isError: true };
        }
        const result = await getClient().put(`/files/${fileId}`, body);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_files_archive",
    {
      title: "elnora_files_archive",
      description: "Archive (delete) a file",
      inputSchema: {
        fileId: z.string().uuid().describe("File UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_files_archive", getContext, async ({ fileId }) => {
      try {
        await getClient().del(`/files/${fileId}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ archived: true, fileId }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_files_versions",
    {
      title: "elnora_files_versions",
      description: "List versions of a file",
      inputSchema: {
        fileId: z.string().uuid().describe("File UUID"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        pageSize: z.number().int().min(1).max(100).default(25).describe("Results per page"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_files_versions", getContext, async ({ fileId, page, pageSize }) => {
      try {
        const result = await getClient().get(`/files/${fileId}/versions`, { page, pageSize });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_files_versionContent",
    {
      title: "elnora_files_versionContent",
      description: "Get the raw content of a specific file version",
      inputSchema: {
        fileId: z.string().uuid().describe("File UUID"),
        versionId: z.string().uuid().describe("Version UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_files_versionContent", getContext, async ({ fileId, versionId }) => {
      try {
        const result = await getClient().get(`/files/${fileId}/versions/${versionId}/content`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_files_createVersion",
    {
      title: "elnora_files_createVersion",
      description: "Create a new version of a file",
      inputSchema: {
        fileId: z.string().uuid().describe("File UUID"),
        content: z.string().min(1).max(CHARACTER_LIMIT).describe("Version content"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_files_createVersion", getContext, async ({ fileId, content }) => {
      try {
        const result = await getClient().post(`/files/${fileId}/versions`, { content });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_files_restore",
    {
      title: "elnora_files_restore",
      description: "Restore a file to a specific version",
      inputSchema: {
        fileId: z.string().uuid().describe("File UUID"),
        versionId: z.string().uuid().describe("Version UUID to restore"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_files_restore", getContext, async ({ fileId, versionId }) => {
      try {
        const result = await getClient().post(`/files/${fileId}/versions/${versionId}/restore`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_files_promote",
    {
      title: "elnora_files_promote",
      description: "Promote a file to a new visibility level",
      inputSchema: {
        fileId: z.string().uuid().describe("File UUID"),
        visibility: z.string().min(1).describe("Target visibility level"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_files_promote", getContext, async ({ fileId, visibility }) => {
      try {
        const result = await getClient().post(`/files/${fileId}/promote`, { visibility });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_files_fork",
    {
      title: "elnora_files_fork",
      description: "Fork a file to another project",
      inputSchema: {
        fileId: z.string().uuid().describe("File UUID"),
        targetProject: z.string().uuid().describe("Target project UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_files_fork", getContext, async ({ fileId, targetProject }) => {
      try {
        const result = await getClient().post(`/files/${fileId}/fork`, { targetProjectId: targetProject });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_files_workingCopy",
    {
      title: "elnora_files_workingCopy",
      description: "Create a working copy of a file",
      inputSchema: {
        fileId: z.string().uuid().describe("File UUID"),
        task: z.string().uuid().optional().describe("Associated task UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_files_workingCopy", getContext, async ({ fileId, task }) => {
      try {
        const body: Record<string, string> = {};
        if (task) body.taskId = task;
        const result = await getClient().post(`/files/${fileId}/working-copy`, body);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_files_commit",
    {
      title: "elnora_files_commit",
      description: "Commit a file's working copy",
      inputSchema: {
        fileId: z.string().uuid().describe("File UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_files_commit", getContext, async ({ fileId }) => {
      try {
        const result = await getClient().post(`/files/${fileId}/commit`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_files_searchContent",
    {
      title: "elnora_files_searchContent",
      description: "Search file content across projects",
      inputSchema: {
        project: z.string().uuid().optional().describe("Restrict search to a project"),
        query: z.string().min(1).max(1000).describe("Search query"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        pageSize: z.number().int().min(1).max(100).default(25).describe("Results per page"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_files_searchContent", getContext, async ({ project, query, page, pageSize }) => {
      try {
        const params: Record<string, string | number> = { q: query, page, pageSize };
        if (project) params.projectId = project;
        const result = await getClient().get("/search/file-content", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
