import { describe, it, expect } from "vitest";
import { createElnoraServer, RequestContext } from "../../src/server.js";
import { ElnoraApiClient } from "../../src/services/elnora-api-client.js";
import { ElnoraConfig } from "../../src/types.js";
import { TOOL_SCOPES } from "../../src/tools/scope-guard.js";
import { ALL_SCOPES } from "../../src/constants.js";

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

function createTestContext(): RequestContext {
  const client = new ElnoraApiClient(mockConfig, "test-token");
  return { client, clientId: "test", scopes: ALL_SCOPES };
}

describe("Tool Registration", () => {
  it("registers all expected tools", () => {
    const getContext = () => createTestContext();
    const server = createElnoraServer(getContext);

    // Access internal tool registry — McpServer stores tools in _registeredTools
    const registeredTools = Object.keys(
      (server as unknown as Record<string, Record<string, unknown>>)._registeredTools,
    );
    const expectedTools = Object.keys(TOOL_SCOPES);

    expect(registeredTools.length).toBeGreaterThanOrEqual(expectedTools.length);
    for (const toolName of expectedTools) {
      expect(registeredTools, `Tool "${toolName}" not registered on server`).toContain(toolName);
    }
  });

  it("has scope definitions for all tool groups", () => {
    const toolGroups = {
      tasks: ["elnora_tasks_list", "elnora_tasks_get", "elnora_tasks_messages", "elnora_tasks_create", "elnora_tasks_send", "elnora_tasks_update", "elnora_tasks_archive"],
      files: ["elnora_files_list", "elnora_files_get", "elnora_files_content", "elnora_files_versions", "elnora_files_versionContent", "elnora_files_upload", "elnora_files_create", "elnora_files_update", "elnora_files_archive", "elnora_files_download", "elnora_files_createVersion", "elnora_files_restore", "elnora_files_promote", "elnora_files_fork", "elnora_files_workingCopy", "elnora_files_commit", "elnora_files_uploadBatch", "elnora_files_confirmUpload", "elnora_files_searchContent"],
      projects: ["elnora_projects_list", "elnora_projects_get", "elnora_projects_create", "elnora_projects_update", "elnora_projects_archive", "elnora_projects_members", "elnora_projects_addMember", "elnora_projects_updateRole", "elnora_projects_removeMember", "elnora_projects_leave"],
      search: ["elnora_search_tasks", "elnora_search_files", "elnora_search_all", "elnora_search_fileContent"],
      orgs: ["elnora_orgs_list", "elnora_orgs_get", "elnora_orgs_create", "elnora_orgs_update", "elnora_orgs_delete", "elnora_orgs_members", "elnora_orgs_updateRole", "elnora_orgs_removeMember", "elnora_orgs_billing", "elnora_orgs_setStripe", "elnora_orgs_setDefault", "elnora_orgs_invite", "elnora_orgs_invitations", "elnora_orgs_cancelInvite", "elnora_orgs_resendInvite", "elnora_orgs_invitationInfo", "elnora_orgs_acceptInvite", "elnora_orgs_files", "elnora_orgs_listAll"],
      folders: ["elnora_folders_list", "elnora_folders_create", "elnora_folders_rename", "elnora_folders_move", "elnora_folders_delete"],
      library: ["elnora_library_files", "elnora_library_folders", "elnora_library_createFolder", "elnora_library_renameFolder", "elnora_library_deleteFolder"],
      apiKeys: ["elnora_api-keys_list", "elnora_api-keys_create", "elnora_api-keys_revoke", "elnora_api-keys_getPolicy", "elnora_api-keys_setPolicy"],
      audit: ["elnora_audit_list"],
      account: ["elnora_account_get", "elnora_account_update", "elnora_account_agreements", "elnora_account_acceptTerms", "elnora_account_delete", "elnora_account_users", "elnora_account_addLegalDoc", "elnora_account_updateLegalDoc", "elnora_account_deleteLegalDoc"],
      feedback: ["elnora_feedback_submit"],
      flags: ["elnora_flags_list", "elnora_flags_get", "elnora_flags_set"],
      health: ["elnora_health_check"],
      protocols: ["elnora_protocols_generate"],
    };

    for (const [group, tools] of Object.entries(toolGroups)) {
      for (const tool of tools) {
        expect(TOOL_SCOPES, `Missing scope for ${tool} in group ${group}`).toHaveProperty(tool);
      }
    }
  });

  it("server creates without errors", () => {
    const getContext = () => createTestContext();
    const server = createElnoraServer(getContext);
    expect(server).toBeDefined();
  });
});

describe("ElnoraApiClient", () => {
  it("creates with bearer token auth", () => {
    const client = new ElnoraApiClient(mockConfig, "test-bearer-token");
    expect(client).toBeDefined();
  });

  it("creates with API key auth", () => {
    const client = new ElnoraApiClient(mockConfig, { apiKey: "elnora_live_1234567890abcdef" });
    expect(client).toBeDefined();
  });
});
