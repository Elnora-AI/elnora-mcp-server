import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";
import { CHARACTER_LIMIT } from "../constants.js";

export function registerFileTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_list_files",
    {
      title: "List Files",
      description: "List files in a project or workspace.",
      inputSchema: {
        project_id: z.string().uuid().optional().describe("Filter by project UUID"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        page_size: z.number().int().min(1).max(100).default(25).describe("Results per page"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_list_files", getContext, async ({ project_id, page, page_size }) => {
      try {
        const path = project_id ? `/projects/${project_id}/files` : "/files";
        const result = await getClient().get(path, { page, pageSize: page_size });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_get_file",
    {
      title: "Get File",
      description: "Get file metadata by UUID.",
      inputSchema: {
        file_id: z.string().uuid().describe("File UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_get_file", getContext, async ({ file_id }) => {
      try {
        const result = await getClient().get(`/files/${file_id}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_get_file_content",
    {
      title: "Get File Content",
      description: "Retrieve the content of a file by ID.",
      inputSchema: {
        file_id: z.string().uuid().describe("File UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_get_file_content", getContext, async ({ file_id }) => {
      try {
        const result = await getClient().getFileContent(file_id);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_get_file_versions",
    {
      title: "Get File Versions",
      description: "Get version history for a file.",
      inputSchema: {
        file_id: z.string().uuid().describe("File UUID"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        page_size: z.number().int().min(1).max(100).default(25).describe("Results per page"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_get_file_versions", getContext, async ({ file_id, page, page_size }) => {
      try {
        const result = await getClient().get(`/files/${file_id}/versions`, { page, pageSize: page_size });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_get_version_content",
    {
      title: "Get Version Content",
      description: "Get content of a specific file version.",
      inputSchema: {
        file_id: z.string().uuid().describe("File UUID"),
        version_id: z.string().uuid().describe("Version UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_get_version_content", getContext, async ({ file_id, version_id }) => {
      try {
        const result = await getClient().get(`/files/${file_id}/versions/${version_id}/content`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_upload_file",
    {
      title: "Upload File",
      description: "Upload a text file to Elnora.",
      inputSchema: {
        name: z.string().min(1).max(255).describe("Filename"),
        content: z.string().min(1).max(CHARACTER_LIMIT).describe("File content"),
        file_type: z.string().optional().describe("MIME type (default: text/markdown)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_upload_file", getContext, async ({ name, content, file_type }) => {
      try {
        const result = await getClient().uploadFile(name, content, file_type);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_create_file",
    {
      title: "Create File",
      description: "Create a new empty file in a project.",
      inputSchema: {
        project_id: z.string().uuid().describe("Project UUID"),
        name: z.string().min(1).max(255).describe("Filename"),
        folder_id: z.string().uuid().optional().describe("Folder UUID"),
        file_type: z.string().optional().describe("File type"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_create_file", getContext, async ({ project_id, name, folder_id, file_type }) => {
      try {
        const result = await getClient().post("/files", {
          projectId: project_id, name, folderId: folder_id, fileType: file_type,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_update_file",
    {
      title: "Update File",
      description: "Update file metadata (rename or move).",
      inputSchema: {
        file_id: z.string().uuid().describe("File UUID"),
        name: z.string().min(1).max(255).optional().describe("New name"),
        folder_id: z.string().uuid().optional().describe("New folder UUID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_update_file", getContext, async ({ file_id, name, folder_id }) => {
      try {
        const result = await getClient().put(`/files/${file_id}`, { name, folderId: folder_id });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_archive_file",
    {
      title: "Archive File",
      description: "Archive (delete) a file.",
      inputSchema: {
        file_id: z.string().uuid().describe("File UUID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_archive_file", getContext, async ({ file_id }) => {
      try {
        await getClient().del(`/files/${file_id}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ archived: true, fileId: file_id }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_download_file",
    {
      title: "Download File",
      description: "Download a file (returns download URL or content).",
      inputSchema: {
        file_id: z.string().uuid().describe("File UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_download_file", getContext, async ({ file_id }) => {
      try {
        const result = await getClient().get(`/files/${file_id}/download`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_create_version",
    {
      title: "Create File Version",
      description: "Create a new version of a file.",
      inputSchema: {
        file_id: z.string().uuid().describe("File UUID"),
        content: z.string().max(CHARACTER_LIMIT).optional().describe("Version content"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_create_version", getContext, async ({ file_id, content }) => {
      try {
        const result = await getClient().post(`/files/${file_id}/versions`, { content });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_restore_version",
    {
      title: "Restore File Version",
      description: "Restore a file to a specific version.",
      inputSchema: {
        file_id: z.string().uuid().describe("File UUID"),
        version_id: z.string().uuid().describe("Version UUID to restore"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_restore_version", getContext, async ({ file_id, version_id }) => {
      try {
        const result = await getClient().post(`/files/${file_id}/versions/${version_id}/restore`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_promote_file",
    {
      title: "Promote File",
      description: "Promote file visibility (e.g., to organization library).",
      inputSchema: {
        file_id: z.string().uuid().describe("File UUID"),
        visibility: z.string().describe("Target visibility level"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_promote_file", getContext, async ({ file_id, visibility }) => {
      try {
        const result = await getClient().post(`/files/${file_id}/promote`, { visibility });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_fork_file",
    {
      title: "Fork File",
      description: "Fork a file to another project.",
      inputSchema: {
        file_id: z.string().uuid().describe("File UUID"),
        target_project_id: z.string().uuid().describe("Target project UUID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_fork_file", getContext, async ({ file_id, target_project_id }) => {
      try {
        const result = await getClient().post(`/files/${file_id}/fork`, { targetProjectId: target_project_id });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_create_working_copy",
    {
      title: "Create Working Copy",
      description: "Create a working copy of a file for editing.",
      inputSchema: {
        file_id: z.string().uuid().describe("File UUID"),
        task_id: z.string().uuid().optional().describe("Associated task UUID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_create_working_copy", getContext, async ({ file_id, task_id }) => {
      try {
        const params: Record<string, string | number | undefined> = {};
        if (task_id) params.taskId = task_id;
        const result = await getClient().post(`/files/${file_id}/working-copy`, params);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_commit_working_copy",
    {
      title: "Commit Working Copy",
      description: "Commit a working copy back to the file.",
      inputSchema: {
        file_id: z.string().uuid().describe("File UUID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_commit_working_copy", getContext, async ({ file_id }) => {
      try {
        const result = await getClient().post(`/files/${file_id}/commit`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_initiate_upload",
    {
      title: "Initiate File Upload",
      description: "Initiate a multi-step file upload. Returns a presigned URL for uploading the file content.",
      inputSchema: {
        project_id: z.string().uuid().describe("Project UUID"),
        file_name: z.string().min(1).max(255).describe("Filename"),
        content_type: z.string().default("application/octet-stream").describe("MIME content type"),
        file_size_bytes: z.number().int().min(1).describe("File size in bytes"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_initiate_upload", getContext, async ({ project_id, file_name, content_type, file_size_bytes }) => {
      try {
        const result = await getClient().post("/files/upload", {
          projectId: project_id, fileName: file_name, contentType: content_type, fileSizeBytes: file_size_bytes,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_confirm_upload",
    {
      title: "Confirm File Upload",
      description: "Confirm that a file upload to the presigned URL has completed.",
      inputSchema: {
        file_id: z.string().uuid().describe("File UUID from initiate_upload"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_confirm_upload", getContext, async ({ file_id }) => {
      try {
        const result = await getClient().post(`/files/${file_id}/upload/confirm`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
