import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";
import { OUTPUT_OPTIONS_SCHEMA } from "../services/response-formatter.js";

export function registerOrgTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_orgs_list",
    {
      title: "elnora_orgs_list",
      description: "List all organizations the current user belongs to",
      inputSchema: {
        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_orgs_list", getContext, async () => {
      try {
        const result = await getClient().get("/organizations");
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_orgs_get",
    {
      title: "elnora_orgs_get",
      description: "Get details of a specific organization",
      inputSchema: {
        orgId: z.string().uuid().describe("Organization UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_orgs_get", getContext, async ({ orgId }) => {
      try {
        const result = await getClient().get(`/organizations/${orgId}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_orgs_create",
    {
      title: "elnora_orgs_create",
      description: "Create a new organization",
      inputSchema: {
        name: z.string().min(1).max(200).describe("Organization name"),
        description: z.string().max(2000).optional().describe("Description"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_orgs_create", getContext, async ({ name, description }) => {
      try {
        const result = await getClient().post("/organizations", { name, description });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_orgs_update",
    {
      title: "elnora_orgs_update",
      description: "Update an existing organization",
      inputSchema: {
        orgId: z.string().uuid().describe("Organization UUID"),
        name: z.string().min(1).max(200).optional().describe("New name"),
        description: z.string().max(2000).optional().describe("New description"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_orgs_update", getContext, async ({ orgId, name, description }) => {
      try {
        const body: Record<string, string> = {};
        if (name !== undefined) body.name = name;
        if (description !== undefined) body.description = description;
        if (Object.keys(body).length === 0) {
          return { content: [{ type: "text" as const, text: "Error: At least one field (name or description) must be provided." }], isError: true };
        }
        const result = await getClient().put(`/organizations/${orgId}`, body);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_orgs_delete",
    {
      title: "elnora_orgs_delete",
      description: "Delete an organization",
      inputSchema: {
        orgId: z.string().uuid().describe("Organization UUID"),
        yes: z.boolean().optional().default(false).describe("Skip confirmation (required true for MCP)"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_orgs_delete", getContext, async ({ orgId, yes }) => {
      try {
        if (!yes) {
          return { content: [{ type: "text" as const, text: "Error: Organization deletion requires yes=true to confirm." }], isError: true };
        }
        await getClient().del(`/organizations/${orgId}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, orgId }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_orgs_members",
    {
      title: "elnora_orgs_members",
      description: "List members of an organization",
      inputSchema: {
        orgId: z.string().uuid().describe("Organization UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_orgs_members", getContext, async ({ orgId }) => {
      try {
        const result = await getClient().get(`/organizations/${orgId}/members`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_orgs_updateRole",
    {
      title: "elnora_orgs_updateRole",
      description: "Update an organization member's role",
      inputSchema: {
        orgId: z.string().uuid().describe("Organization UUID"),
        membershipId: z.string().uuid().describe("Membership ID"),
        role: z.string().min(1).max(100).describe("New role"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_orgs_updateRole", getContext, async ({ orgId, membershipId, role }) => {
      try {
        const result = await getClient().put(`/organizations/${orgId}/members/${membershipId}/role`, { role });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_orgs_removeMember",
    {
      title: "elnora_orgs_removeMember",
      description: "Remove a member from an organization",
      inputSchema: {
        orgId: z.string().uuid().describe("Organization UUID"),
        membershipId: z.string().uuid().describe("Membership ID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_orgs_removeMember", getContext, async ({ orgId, membershipId }) => {
      try {
        await getClient().del(`/organizations/${orgId}/members/${membershipId}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ removed: true, membershipId }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_orgs_billing",
    {
      title: "elnora_orgs_billing",
      description: "Get billing status for an organization",
      inputSchema: {
        orgId: z.string().uuid().describe("Organization UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_orgs_billing", getContext, async ({ orgId }) => {
      try {
        const result = await getClient().get(`/organizations/${orgId}/billing-status`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_orgs_setStripe",
    {
      title: "elnora_orgs_setStripe",
      description: "Set the Stripe customer ID for an organization",
      inputSchema: {
        orgId: z.string().uuid().describe("Organization UUID"),
        customerId: z.string().min(1).describe("Stripe customer ID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_orgs_setStripe", getContext, async ({ orgId, customerId }) => {
      try {
        const result = await getClient().put(`/organizations/${orgId}/stripe-customer`, { customerId });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_orgs_setDefault",
    {
      title: "elnora_orgs_setDefault",
      description: "Set an organization as the default",
      inputSchema: {
        orgId: z.string().uuid().describe("Organization UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_orgs_setDefault", getContext, async ({ orgId }) => {
      try {
        const result = await getClient().put(`/organizations/${orgId}/default`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_orgs_invite",
    {
      title: "elnora_orgs_invite",
      description: "Invite a user to an organization by email",
      inputSchema: {
        orgId: z.string().uuid().describe("Organization UUID"),
        email: z.string().email().describe("Email to invite"),
        role: z.string().optional().describe("Role for invitee"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_orgs_invite", getContext, async ({ orgId, email, role }) => {
      try {
        const result = await getClient().post(`/organizations/${orgId}/invitations`, { email, role });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_orgs_invitations",
    {
      title: "elnora_orgs_invitations",
      description: "List pending invitations for an organization",
      inputSchema: {
        orgId: z.string().uuid().describe("Organization UUID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_orgs_invitations", getContext, async ({ orgId }) => {
      try {
        const result = await getClient().get(`/organizations/${orgId}/invitations`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_orgs_cancelInvite",
    {
      title: "elnora_orgs_cancelInvite",
      description: "Cancel a pending organization invitation",
      inputSchema: {
        orgId: z.string().uuid().describe("Organization UUID"),
        invitationId: z.string().min(1).max(255).describe("Invitation ID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_orgs_cancelInvite", getContext, async ({ orgId, invitationId }) => {
      try {
        await getClient().del(`/organizations/${orgId}/invitations/${invitationId}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ cancelled: true, invitationId }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_orgs_resendInvite",
    {
      title: "elnora_orgs_resendInvite",
      description: "Resend an organization invitation email. Regenerates the token and extends the expiry by 7 days. Works on both pending and expired invitations, preserves the invitation ID.",
      inputSchema: {
        orgId: z.string().uuid().describe("Organization UUID"),
        invitationId: z.string().min(1).max(255).describe("Invitation ID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_orgs_resendInvite", getContext, async ({ orgId, invitationId }) => {
      try {
        const result = await getClient().post(`/organizations/${orgId}/invitations/${invitationId}/resend`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_orgs_invitationInfo",
    {
      title: "elnora_orgs_invitationInfo",
      description: "Get information about an invitation by token",
      inputSchema: {
        token: z.string().min(1).max(500).describe("Invitation token"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_orgs_invitationInfo", getContext, async ({ token }) => {
      try {
        const result = await getClient().get(`/invitations/${token}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_orgs_acceptInvite",
    {
      title: "elnora_orgs_acceptInvite",
      description: "Accept an organization invitation by token",
      inputSchema: {
        token: z.string().min(1).max(500).describe("Invitation token"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_orgs_acceptInvite", getContext, async ({ token }) => {
      try {
        const result = await getClient().post(`/invitations/${token}/accept`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_orgs_files",
    {
      title: "elnora_orgs_files",
      description: "List files belonging to an organization",
      inputSchema: {
        orgId: z.string().uuid().describe("Organization UUID"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        pageSize: z.number().int().min(1).max(100).default(25).describe("Results per page"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_orgs_files", getContext, async ({ orgId, page, pageSize }) => {
      try {
        const result = await getClient().get(`/organizations/${orgId}/files`, { page, pageSize });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_orgs_listAll",
    {
      title: "elnora_orgs_listAll",
      description: "List all organizations (admin)",
      inputSchema: {
        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_orgs_listAll", getContext, async () => {
      try {
        const result = await getClient().get("/admin/organizations");
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
