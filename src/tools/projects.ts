import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { withGuard } from "./with-guard.js";
import { OUTPUT_OPTIONS_SCHEMA } from "../services/response-formatter.js";
import { projectsRemovedResult } from "../services/deprecated.js";

/**
 * The `elnora_projects_*` tools are deprecated no-ops (ELN-880/881 removed the
 * platform "project" concept). They stay registered with unchanged names and
 * input schemas — so the CLI↔MCP parity gate and any existing MCP clients keep
 * resolving — but no longer call the retired `/projects` compat shim. Each
 * returns a structured deprecation notice. `getClient` is intentionally unused.
 */
export function registerProjectTools(
  server: McpServer,
  _getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_projects_list",
    {
      title: "elnora_projects_list",
      description: "[DEPRECATED] List all projects accessible to the current user — projects were removed; this is a no-op.",
      inputSchema: {
        page: z.number().int().min(1).default(1).describe("Page number"),
        pageSize: z.number().int().min(1).max(100).default(25).describe("Results per page"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_projects_list", getContext, async () => projectsRemovedResult({ items: [], totalCount: 0 })),
  );

  server.registerTool(
    "elnora_projects_get",
    {
      title: "elnora_projects_get",
      description: "[DEPRECATED] Get details of a specific project — projects were removed; this is a no-op.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_projects_get", getContext, async () => projectsRemovedResult()),
  );

  server.registerTool(
    "elnora_projects_create",
    {
      title: "elnora_projects_create",
      description: "[DEPRECATED] Create a new project — projects were removed; this is a no-op.",
      inputSchema: {
        name: z.string().min(1).max(200).describe("Project name"),
        description: z.string().max(2000).optional().describe("Project description"),
        icon: z.string().max(50).optional().describe("Project icon"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_projects_create", getContext, async () => projectsRemovedResult()),
  );

  server.registerTool(
    "elnora_projects_update",
    {
      title: "elnora_projects_update",
      description: "[DEPRECATED] Update an existing project — projects were removed; this is a no-op.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        name: z.string().min(1).max(200).optional().describe("New name"),
        description: z.string().max(2000).optional().describe("New description"),
        icon: z.string().max(50).optional().describe("New icon"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_projects_update", getContext, async () => projectsRemovedResult()),
  );

  server.registerTool(
    "elnora_projects_archive",
    {
      title: "elnora_projects_archive",
      description: "[DEPRECATED] Archive (delete) a project — projects were removed; this is a no-op.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_projects_archive", getContext, async () => projectsRemovedResult()),
  );

  server.registerTool(
    "elnora_projects_members",
    {
      title: "elnora_projects_members",
      description: "[DEPRECATED] List members of a project — projects were removed; this is a no-op.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_projects_members", getContext, async () => projectsRemovedResult()),
  );

  server.registerTool(
    "elnora_projects_addMember",
    {
      title: "elnora_projects_addMember",
      description: "[DEPRECATED] Add a member to a project — projects were removed; this is a no-op.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        userId: z.string().min(1).max(255).describe("User ID to add"),
        role: z.string().max(100).default("Member").describe("Role (default: Member)"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_projects_addMember", getContext, async () => projectsRemovedResult()),
  );

  server.registerTool(
    "elnora_projects_updateRole",
    {
      title: "elnora_projects_updateRole",
      description: "[DEPRECATED] Update a project member's role — projects were removed; this is a no-op.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        userId: z.string().min(1).max(255).describe("User ID"),
        role: z.string().min(1).max(100).describe("New role"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_projects_updateRole", getContext, async () => projectsRemovedResult()),
  );

  server.registerTool(
    "elnora_projects_removeMember",
    {
      title: "elnora_projects_removeMember",
      description: "[DEPRECATED] Remove a member from a project — projects were removed; this is a no-op.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        userId: z.string().min(1).max(255).describe("User ID to remove"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_projects_removeMember", getContext, async () => projectsRemovedResult()),
  );

  server.registerTool(
    "elnora_projects_leave",
    {
      title: "elnora_projects_leave",
      description: "[DEPRECATED] Leave a project — projects were removed; this is a no-op.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_projects_leave", getContext, async () => projectsRemovedResult()),
  );
}
