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
      title: "Search Tasks",
      description: "Full-text search across tasks.",
      inputSchema: {
        org_id: z.string().uuid().optional().describe("Organization UUID (optional, defaults to active org)"),
        query: z.string().min(1).max(1000).describe("Search query"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        page_size: z.number().int().min(1).max(100).default(25).describe("Results per page"),
        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_search_tasks", getContext, async ({ org_id, query, page, page_size }) => {
      try {
        const client = getClient();
        if (org_id) client.setOrgContext(org_id);
        const result = await client.get("/search/tasks", { q: query, page, pageSize: page_size });
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
        org_id: z.string().uuid().optional().describe("Organization UUID (optional, defaults to active org)"),
        query: z.string().min(1).max(1000).describe("Search query"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        page_size: z.number().int().min(1).max(100).default(25).describe("Results per page"),
        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_search_files", getContext, async ({ org_id, query, page, page_size }) => {
      try {
        const client = getClient();
        if (org_id) client.setOrgContext(org_id);
        const result = await client.get("/search/files", { q: query, page, pageSize: page_size });
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
        org_id: z.string().uuid().optional().describe("Organization UUID (optional, defaults to active org)"),
        query: z.string().min(1).max(1000).describe("Search query"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        page_size: z.number().int().min(1).max(100).default(25).describe("Results per page"),
        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_search_all", getContext, async ({ org_id, query, page, page_size }) => {
      try {
        const client = getClient();
        if (org_id) client.setOrgContext(org_id);
        const result = await client.get("/search", { q: query, page, pageSize: page_size });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_search_file_content",
    {
      title: "Search File Content",
      description: "Full-text search inside file bodies. Finds content within protocols and documents, not just metadata.",
      inputSchema: {
        org_id: z.string().uuid().optional().describe("Organization UUID (optional, defaults to active org)"),
        query: z.string().min(1).max(1000).describe("Search query (searches inside file content)"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        page_size: z.number().int().min(1).max(100).default(25).describe("Results per page"),
        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_search_file_content", getContext, async ({ org_id, query, page, page_size }) => {
      try {
        const client = getClient();
        if (org_id) client.setOrgContext(org_id);
        const result = await client.get("/search/file-content", { q: query, page, pageSize: page_size });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
