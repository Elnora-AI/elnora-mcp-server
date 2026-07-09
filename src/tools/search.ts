import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";
import { OUTPUT_OPTIONS_SCHEMA } from "../services/response-formatter.js";

export function registerSearchTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_search_tasks",
    {
      title: "elnora_search_tasks",
      description: "Search tasks by query",
      inputSchema: {
        query: z.string().min(1).max(1000).describe("Search query"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        pageSize: z.number().int().min(1).max(100).default(25).describe("Results per page"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_search_tasks", getContext, async ({ query, page, pageSize }) => {
      try {
        const result = await getClient().get("/search/tasks", { q: query, page, pageSize });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_search_files",
    {
      title: "elnora_search_files",
      description: "Search files by query",
      inputSchema: {
        query: z.string().min(1).max(1000).describe("Search query"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        pageSize: z.number().int().min(1).max(100).default(25).describe("Results per page"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_search_files", getContext, async ({ query, page, pageSize }) => {
      try {
        const result = await getClient().get("/search/files", { q: query, page, pageSize });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_search_all",
    {
      title: "elnora_search_all",
      description: "Search across all entities",
      inputSchema: {
        query: z.string().min(1).max(1000).describe("Search query"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        pageSize: z.number().int().min(1).max(100).default(25).describe("Results per page"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_search_all", getContext, async ({ query, page, pageSize }) => {
      try {
        const result = await getClient().get("/search", { q: query, page, pageSize });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_search_fileContent",
    {
      title: "elnora_search_fileContent",
      description: "Search within file contents",
      inputSchema: {
        projectId: z.string().uuid().optional().describe("Restrict search to a project"),
        query: z.string().min(1).max(1000).describe("Search query (searches inside file content)"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        pageSize: z.number().int().min(1).max(100).default(25).describe("Results per page"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_search_fileContent", getContext, async ({ projectId, query, page, pageSize }) => {
      try {
        const params: Record<string, string | number> = { q: query, page, pageSize };
        if (projectId) params.projectId = projectId;
        const result = await getClient().get("/search/file-content", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
