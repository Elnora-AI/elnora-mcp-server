import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";

export function registerSearchTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_search_tasks",
    {
      title: "Search Tasks",
      description: "Full-text search across tasks.",
      inputSchema: {
        query: z.string().min(1).max(1000).describe("Search query"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        page_size: z.number().int().min(1).max(100).default(25).describe("Results per page"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_search_tasks", getContext, async ({ query, page, page_size }) => {
      try {
        const result = await getClient().get("/search/tasks", { q: query, page, pageSize: page_size });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_search_files",
    {
      title: "Search Files",
      description: "Full-text search across files.",
      inputSchema: {
        query: z.string().min(1).max(1000).describe("Search query"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        page_size: z.number().int().min(1).max(100).default(25).describe("Results per page"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_search_files", getContext, async ({ query, page, page_size }) => {
      try {
        const result = await getClient().get("/search/files", { q: query, page, pageSize: page_size });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_search_all",
    {
      title: "Search All",
      description: "Full-text search across all resources (tasks, files, etc.).",
      inputSchema: {
        query: z.string().min(1).max(1000).describe("Search query"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        page_size: z.number().int().min(1).max(100).default(25).describe("Results per page"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_search_all", getContext, async ({ query, page, page_size }) => {
      try {
        const result = await getClient().get("/search", { q: query, page, pageSize: page_size });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
