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
  mcpServiceKey: "test-service-key",
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

describe("Org context via X-Organization-Id header", () => {
  // After the v1.0 CLI rename, org scoping is NOT a per-tool schema param —
  // it's carried as an HTTP header set via setOrgContext(). This test just
  // verifies that commonly-used renamed tools are registered on the server.
  it("commonly-used tools are registered under the new naming convention", async () => {
    const { createElnoraServer } = await import("../../src/server.js");
    const { ALL_SCOPES } = await import("../../src/constants.js");

    const getContext = () => ({
      client: new ElnoraApiClient(mockConfig, "test-token"),
      clientId: "test",
      scopes: ALL_SCOPES,
    });

    const server = createElnoraServer(getContext);
    const registeredTools = (server as unknown as Record<string, Record<string, unknown>>)._registeredTools;

    const expectedTools = [
      "elnora_projects_list",
      "elnora_projects_get",
      "elnora_projects_create",
      "elnora_tasks_list",
      "elnora_tasks_create",
      "elnora_search_tasks",
      "elnora_search_files",
      "elnora_search_all",
      "elnora_files_list",
      "elnora_files_create",
      "elnora_folders_list",
      "elnora_folders_create",
    ];

    for (const toolName of expectedTools) {
      expect(registeredTools[toolName], `Tool "${toolName}" not registered`).toBeDefined();
    }
  });
});
