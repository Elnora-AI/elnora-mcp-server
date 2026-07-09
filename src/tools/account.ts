import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ElnoraApiClient } from "../services/elnora-api-client.js";
import { RequestContext } from "../server.js";
import { handleApiError } from "../services/error-handler.js";
import { withGuard } from "./with-guard.js";
import { OUTPUT_OPTIONS_SCHEMA } from "../services/response-formatter.js";

export function registerAccountTools(
  server: McpServer,
  getClient: () => ElnoraApiClient,
  getContext: () => RequestContext,
): void {
  server.registerTool(
    "elnora_account_get",
    {
      title: "elnora_account_get",
      description: "Get account details for a user",
      inputSchema: {
        userId: z.number().int().describe("User numeric ID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_account_get", getContext, async ({ userId }) => {
      try {
        const result = await getClient().get(`/account/user/${userId}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_account_update",
    {
      title: "elnora_account_update",
      description: "Update account details for a user",
      inputSchema: {
        userId: z.number().int().describe("User numeric ID"),
        firstName: z.string().max(100).optional().describe("First name"),
        lastName: z.string().max(100).optional().describe("Last name"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_account_update", getContext, async ({ userId, firstName, lastName }) => {
      try {
        const body: Record<string, string> = {};
        if (firstName !== undefined) body.firstName = firstName;
        if (lastName !== undefined) body.lastName = lastName;
        if (Object.keys(body).length === 0) {
          return { content: [{ type: "text" as const, text: "Error: At least one of firstName or lastName must be provided." }], isError: true };
        }
        const result = await getClient().put(`/account/user/${userId}`, body);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_account_agreements",
    {
      title: "elnora_account_agreements",
      description: "List user agreements",
      inputSchema: {
        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_account_agreements", getContext, async () => {
      try {
        const result = await getClient().get("/userAgreement/userAgreements");
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_account_acceptTerms",
    {
      title: "elnora_account_acceptTerms",
      description: "Accept a user agreement / terms of service",
      inputSchema: {
        documentVersionId: z.string().min(1).max(255).describe("Document version ID to accept"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_account_acceptTerms", getContext, async ({ documentVersionId }) => {
      try {
        const result = await getClient().post("/userAgreement/userAgreement", { documentVersionId });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_account_delete",
    {
      title: "elnora_account_delete",
      description: "Delete your own account",
      inputSchema: {
        yes: z.boolean().optional().default(false).describe("Skip confirmation (required true for MCP)"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_account_delete", getContext, async ({ yes }) => {
      try {
        if (!yes) {
          return { content: [{ type: "text" as const, text: "Error: Account deletion requires yes=true to confirm." }], isError: true };
        }
        await getClient().del("/account");
        return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_account_users",
    {
      title: "elnora_account_users",
      description: "List all users (admin)",
      inputSchema: {
        state: z.enum(["Active", "Pending", "Deleted"]).optional().describe("Filter by user state"),
        refCode: z.string().optional().describe("Filter by referral code"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_account_users", getContext, async ({ state, refCode }) => {
      try {
        const query: Record<string, string> = {};
        if (state) query.state = state;
        if (refCode) query.refCode = refCode;
        const result = await getClient().get("/account/users", Object.keys(query).length > 0 ? query : undefined);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_account_addLegalDoc",
    {
      title: "elnora_account_addLegalDoc",
      description: "Add a legal document version (SystemAdmin only)",
      inputSchema: {
        documentType: z.string().min(1).describe("Document type"),
        version: z.string().min(1).describe("Document version string"),
        content: z.string().min(1).describe("Document content"),
        effectiveDate: z.string().optional().describe("Effective date (ISO 8601)"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_account_addLegalDoc", getContext, async ({ documentType, version, content, effectiveDate }) => {
      try {
        const body: Record<string, string> = { documentType, version, content };
        if (effectiveDate) body.effectiveDate = effectiveDate;
        const result = await getClient().post("/legal-docs/versions", body);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_account_updateLegalDoc",
    {
      title: "elnora_account_updateLegalDoc",
      description: "Update a legal document version (SystemAdmin only)",
      inputSchema: {
        versionId: z.string().describe("Legal document version ID"),
        content: z.string().optional().describe("Updated content"),
        effectiveDate: z.string().optional().describe("Updated effective date (ISO 8601)"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_account_updateLegalDoc", getContext, async ({ versionId, content, effectiveDate }) => {
      try {
        const body: Record<string, string> = {};
        if (content !== undefined) body.content = content;
        if (effectiveDate !== undefined) body.effectiveDate = effectiveDate;
        if (Object.keys(body).length === 0) {
          return { content: [{ type: "text" as const, text: "Error: At least one of content or effectiveDate is required." }], isError: true };
        }
        const result = await getClient().patch(`/legal-docs/versions/${versionId}`, body);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_account_deleteLegalDoc",
    {
      title: "elnora_account_deleteLegalDoc",
      description: "Delete a legal document version (SystemAdmin only)",
      inputSchema: {
        versionId: z.string().describe("Legal document version ID"),
        yes: z.boolean().optional().default(false).describe("Skip confirmation (required true for MCP)"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_account_deleteLegalDoc", getContext, async ({ versionId, yes }) => {
      try {
        if (!yes) {
          return { content: [{ type: "text" as const, text: "Error: Legal doc deletion requires yes=true to confirm." }], isError: true };
        }
        await getClient().del(`/legal-docs/versions/${versionId}`);
        return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, versionId }) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
