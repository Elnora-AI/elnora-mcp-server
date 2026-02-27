import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { handleApiError } from "../services/error-handler.js";
import { CHARACTER_LIMIT } from "../constants.js";

export function registerFileTools(server: McpServer, getClient: () => ElnoraApiClient): void {
  server.registerTool(
    "elnora_list_files",
    {
      title: "List Files",
      description:
        "List files in your Elnora workspace. Returns file metadata including name, type, and visibility.",
      inputSchema: {
        project_id: z.string().uuid().optional().describe("Filter by project UUID"),
        limit: z.number().int().min(1).max(100).default(20).describe("Max results"),
        offset: z.number().int().min(0).default(0).describe("Pagination offset"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ project_id, limit, offset }) => {
      try {
        const result = await getClient().listFiles(project_id, limit, offset);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "elnora_get_file_content",
    {
      title: "Get File Content",
      description: "Retrieve the content of a specific file by its ID. Returns the file content as text along with metadata.",
      inputSchema: {
        file_id: z.string().uuid().describe("File UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ file_id }) => {
      try {
        const result = await getClient().getFileContent(file_id);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "elnora_upload_file",
    {
      title: "Upload File",
      description:
        "Upload a text file to Elnora. Files are stored in the user's workspace and can be attached to task messages.",
      inputSchema: {
        name: z.string().min(1).max(255).describe("Filename"),
        content: z.string().min(1).max(CHARACTER_LIMIT).describe("File content (max 25,000 chars)"),
        file_type: z.string().optional().describe("MIME type (default: text/markdown)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ name, content, file_type }) => {
      try {
        const result = await getClient().uploadFile(name, content, file_type);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    },
  );
}
