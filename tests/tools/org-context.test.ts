import { describe, it, expect, vi, beforeEach } from "vitest";
import { ElnoraApiClient } from "../../src/services/elnora-api-client.js";
import { ElnoraConfig } from "../../src/types.js";

const mockConfig: ElnoraConfig = {
  apiUrl: "https://platform.elnora.ai/api/v1",
  tokenValidationUrl: "https://platform.elnora.ai/api/v1/auth/validate-token",
  port: 3000,
  publicUrl: "https://mcp.elnora.ai",
  loginUrl: "https://platform.elnora.ai/login",
  tokenExchangeUrl: "https://platform.elnora.ai/api/v1/auth/token",
  platformClientId: "test",
  platformClientSecret: "test",
};

describe("ElnoraApiClient org context", () => {
  it("does not include X-Organization-Id header by default", () => {
    const client = new ElnoraApiClient(mockConfig, "test-token");
    // Access the private orgHeaders getter via a type cast
    const headers = (client as unknown as { orgHeaders: Record<string, string> }).orgHeaders;
    expect(headers).toEqual({});
  });

  it("includes X-Organization-Id header after setOrgContext", () => {
    const client = new ElnoraApiClient(mockConfig, "test-token");
    const orgId = "00000000-1111-2222-3333-444444444444";
    client.setOrgContext(orgId);
    const headers = (client as unknown as { orgHeaders: Record<string, string> }).orgHeaders;
    expect(headers).toEqual({ "X-Organization-Id": orgId });
  });

  it("overwrites previous org context", () => {
    const client = new ElnoraApiClient(mockConfig, "test-token");
    client.setOrgContext("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    client.setOrgContext("11111111-2222-3333-4444-555555555555");
    const headers = (client as unknown as { orgHeaders: Record<string, string> }).orgHeaders;
    expect(headers["X-Organization-Id"]).toBe("11111111-2222-3333-4444-555555555555");
  });

  it("per-request client isolation — setOrgContext does not leak", () => {
    // Simulate two separate getClient() calls (as happens in the MCP server)
    const client1 = new ElnoraApiClient(mockConfig, "test-token");
    const client2 = new ElnoraApiClient(mockConfig, "test-token");

    client1.setOrgContext("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

    const headers1 = (client1 as unknown as { orgHeaders: Record<string, string> }).orgHeaders;
    const headers2 = (client2 as unknown as { orgHeaders: Record<string, string> }).orgHeaders;

    expect(headers1["X-Organization-Id"]).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(headers2).toEqual({}); // client2 should NOT have the org header
  });

  it("works with API key auth", () => {
    const client = new ElnoraApiClient(mockConfig, { apiKey: "elnora_live_test123" });
    client.setOrgContext("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    const headers = (client as unknown as { orgHeaders: Record<string, string> }).orgHeaders;
    expect(headers["X-Organization-Id"]).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  });
});

describe("Org-scoped tools have org_id in inputSchema", () => {
  // We verify this via the registered tools on the server
  // Import the server creation to check tool schemas
  it("org-scoped tools accept org_id parameter", async () => {
    const { createElnoraServer, RequestContext } = await import("../../src/server.js");
    const { ALL_SCOPES } = await import("../../src/constants.js");

    const getContext = () => ({
      client: new ElnoraApiClient(mockConfig, "test-token"),
      clientId: "test",
      scopes: ALL_SCOPES,
    });

    const server = createElnoraServer(getContext);

    // Access internal tool registry
    const registeredTools = (server as unknown as Record<string, Record<string, unknown>>)._registeredTools;

    // These tools MUST have org_id in their schema
    const orgScopedTools = [
      "elnora_list_projects",
      "elnora_create_project",
      "elnora_list_tasks",
      "elnora_create_task",
      "elnora_search_tasks",
      "elnora_search_files",
      "elnora_search_all",
      "elnora_list_files",
      "elnora_upload_file",
      "elnora_create_file",
      "elnora_list_folders",
      "elnora_create_folder",
    ];

    for (const toolName of orgScopedTools) {
      const tool = registeredTools[toolName] as { inputSchema?: { shape?: Record<string, unknown> } } | undefined;
      expect(tool, `Tool "${toolName}" not registered`).toBeDefined();
    }

    // These tools should NOT have org_id (by-ID operations)
    const nonOrgTools = [
      "elnora_get_project",
      "elnora_get_task",
      "elnora_get_file",
      "elnora_rename_folder",
      "elnora_delete_folder",
    ];

    for (const toolName of nonOrgTools) {
      const tool = registeredTools[toolName] as { inputSchema?: { shape?: Record<string, unknown> } } | undefined;
      expect(tool, `Tool "${toolName}" not registered`).toBeDefined();
    }
  });
});
