import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";

export function registerOrgTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_list_orgs",
    {
      title: "List Organizations",
      description: "List organizations the user belongs to.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_list_orgs", getContext, async () => {
      try {
        const result = await getClient().get("/organizations");
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_get_org",
    {
      title: "Get Organization",
      description: "Get a single organization by UUID.",
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_get_org", getContext, async ({ org_id }) => {
      try {
        const result = await getClient().get(`/organizations/${org_id}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_create_org",
    {
      title: "Create Organization",
      description: "Create a new organization.",
      inputSchema: {
        name: z.string().min(1).max(200).describe("Organization name"),
        description: z.string().max(2000).optional().describe("Description"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_create_org", getContext, async ({ name, description }) => {
      try {
        const result = await getClient().post("/organizations", { name, description });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_update_org",
    {
      title: "Update Organization",
      description: "Update organization metadata.",
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
        name: z.string().min(1).max(200).optional().describe("New name"),
        description: z.string().max(2000).optional().describe("New description"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_update_org", getContext, async ({ org_id, name, description }) => {
      try {
        const result = await getClient().put(`/organizations/${org_id}`, { name, description });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_list_org_members",
    {
      title: "List Organization Members",
      description: "List members of an organization.",
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_list_org_members", getContext, async ({ org_id }) => {
      try {
        const result = await getClient().get(`/organizations/${org_id}/members`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_update_org_member_role",
    {
      title: "Update Org Member Role",
      description: "Change an organization member's role.",
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
        member_id: z.string().max(255).describe("Member ID"),
        role: z.string().max(100).describe("New role"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_update_org_member_role", getContext, async ({ org_id, member_id, role }) => {
      try {
        const result = await getClient().put(`/organizations/${org_id}/members/${member_id}/role`, { role });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_remove_org_member",
    {
      title: "Remove Org Member",
      description: "Remove a member from an organization.",
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
        member_id: z.string().max(255).describe("Member ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_remove_org_member", getContext, async ({ org_id, member_id }) => {
      try {
        await getClient().del(`/organizations/${org_id}/members/${member_id}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ removed: true, memberId: member_id }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_get_org_billing",
    {
      title: "Get Org Billing",
      description: "Get billing status for an organization.",
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_get_org_billing", getContext, async ({ org_id }) => {
      try {
        const result = await getClient().get(`/organizations/${org_id}/billing-status`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_invite_org_member",
    {
      title: "Invite to Organization",
      description: "Send an invitation to join an organization.",
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
        email: z.string().email().describe("Email to invite"),
        role: z.string().optional().describe("Role for invitee"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_invite_org_member", getContext, async ({ org_id, email, role }) => {
      try {
        const result = await getClient().post(`/organizations/${org_id}/invitations`, { email, role });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_list_org_invitations",
    {
      title: "List Org Invitations",
      description: "List pending invitations for an organization.",
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_list_org_invitations", getContext, async ({ org_id }) => {
      try {
        const result = await getClient().get(`/organizations/${org_id}/invitations`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_cancel_org_invitation",
    {
      title: "Cancel Org Invitation",
      description: "Cancel a pending organization invitation.",
      inputSchema: {
        org_id: z.string().uuid().describe("Organization UUID"),
        invitation_id: z.string().max(255).describe("Invitation ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_cancel_org_invitation", getContext, async ({ org_id, invitation_id }) => {
      try {
        await getClient().del(`/organizations/${org_id}/invitations/${invitation_id}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ cancelled: true, invitationId: invitation_id }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_get_invitation_info",
    {
      title: "Get Invitation Info",
      description: "Get invitation details by token (public endpoint).",
      inputSchema: {
        token: z.string().max(500).describe("Invitation token"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_get_invitation_info", getContext, async ({ token }) => {
      try {
        const result = await getClient().get(`/invitations/${token}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_accept_invitation",
    {
      title: "Accept Invitation",
      description: "Accept an organization invitation by token.",
      inputSchema: {
        token: z.string().max(500).describe("Invitation token"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_accept_invitation", getContext, async ({ token }) => {
      try {
        const result = await getClient().post(`/invitations/${token}/accept`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
