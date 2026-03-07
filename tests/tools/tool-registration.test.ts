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
      tasks: ["elnora_list_tasks", "elnora_get_task", "elnora_get_task_messages", "elnora_create_task", "elnora_update_task", "elnora_archive_task"],
      messages: ["elnora_send_message"],
      files: ["elnora_list_files", "elnora_get_file", "elnora_get_file_content", "elnora_get_file_versions", "elnora_get_version_content", "elnora_upload_file", "elnora_create_file", "elnora_update_file", "elnora_archive_file", "elnora_download_file", "elnora_create_version", "elnora_restore_version", "elnora_promote_file", "elnora_fork_file", "elnora_create_working_copy", "elnora_commit_working_copy", "elnora_initiate_upload", "elnora_confirm_upload"],
      projects: ["elnora_list_projects", "elnora_get_project", "elnora_create_project", "elnora_update_project", "elnora_archive_project", "elnora_list_project_members", "elnora_add_project_member", "elnora_update_project_member_role", "elnora_remove_project_member", "elnora_leave_project"],
      search: ["elnora_search_tasks", "elnora_search_files", "elnora_search_all"],
      orgs: ["elnora_list_orgs", "elnora_get_org", "elnora_create_org", "elnora_update_org", "elnora_list_org_members", "elnora_update_org_member_role", "elnora_remove_org_member", "elnora_get_org_billing", "elnora_invite_org_member", "elnora_list_org_invitations", "elnora_cancel_org_invitation", "elnora_get_invitation_info", "elnora_accept_invitation"],
      folders: ["elnora_list_folders", "elnora_create_folder", "elnora_rename_folder", "elnora_move_folder", "elnora_delete_folder"],
      library: ["elnora_list_library_files", "elnora_list_library_folders", "elnora_create_library_folder", "elnora_rename_library_folder", "elnora_delete_library_folder"],
      apiKeys: ["elnora_list_api_keys", "elnora_create_api_key", "elnora_revoke_api_key"],
      audit: ["elnora_list_audit_log"],
      account: ["elnora_get_account", "elnora_update_account", "elnora_list_agreements", "elnora_accept_terms"],
      feedback: ["elnora_submit_feedback"],
      flags: ["elnora_list_flags", "elnora_get_flag"],
      health: ["elnora_health_check"],
      protocols: ["elnora_generate_protocol"],
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
