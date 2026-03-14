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
    "elnora_get_account",
    {
      title: "Get Account",
      description: "Get user account by numeric ID.",
      inputSchema: {
        user_id: z.number().int().describe("User numeric ID"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_get_account", getContext, async ({ user_id }) => {
      try {
        const result = await getClient().get(`/account/user/${user_id}`);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_update_account",
    {
      title: "Update Account",
      description: "Update user account name.",
      inputSchema: {
        user_id: z.number().int().describe("User numeric ID"),
        first_name: z.string().max(100).optional().describe("First name"),
        last_name: z.string().max(100).optional().describe("Last name"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_update_account", getContext, async ({ user_id, first_name, last_name }) => {
      try {
        const body: Record<string, string> = {};
        if (first_name !== undefined) body.firstName = first_name;
        if (last_name !== undefined) body.lastName = last_name;
        if (Object.keys(body).length === 0) {
          return { content: [{ type: "text" as const, text: "Error: At least one field (first_name or last_name) must be provided." }], isError: true };
        }
        const result = await getClient().put(`/account/user/${user_id}`, body);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_list_agreements",
    {
      title: "List Agreements",
      description: "List all user agreements (terms of service, etc.).",
      inputSchema: {
        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withGuard("elnora_list_agreements", getContext, async () => {
      try {
        const result = await getClient().get("/userAgreement/userAgreements");
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );

  server.registerTool(
    "elnora_accept_terms",
    {
      title: "Accept Terms",
      description: "Accept a user agreement version.",
      inputSchema: {
        document_version_id: z.string().min(1).max(255).describe("Document version ID to accept"),

        ...OUTPUT_OPTIONS_SCHEMA,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    withGuard("elnora_accept_terms", getContext, async ({ document_version_id }) => {
      try {
        const result = await getClient().post("/userAgreement/userAgreement", { documentVersionId: document_version_id });
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }),
  );
}
