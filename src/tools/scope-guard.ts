/**
 * Per-tool scope enforcement.
 * CoSAI MCP-T2: Least privilege — each tool declares required scopes.
 */
export const TOOL_SCOPES: Record<string, string[]> = {
  // Tasks
  elnora_list_tasks: ["tasks:read"],
  elnora_get_task: ["tasks:read"],
  elnora_get_task_messages: ["tasks:read"],
  elnora_create_task: ["tasks:write"],
  elnora_update_task: ["tasks:write"],
  elnora_archive_task: ["tasks:write"],

  // Messages
  elnora_send_message: ["messages:write"],

  // Files
  elnora_list_files: ["files:read"],
  elnora_get_file: ["files:read"],
  elnora_get_file_content: ["files:read"],
  elnora_get_file_versions: ["files:read"],
  elnora_get_version_content: ["files:read"],
  elnora_upload_file: ["files:write"],
  elnora_create_file: ["files:write"],
  elnora_update_file: ["files:write"],
  elnora_archive_file: ["files:write"],
  elnora_download_file: ["files:read"],
  elnora_create_version: ["files:write"],
  elnora_restore_version: ["files:write"],
  elnora_promote_file: ["files:write"],
  elnora_fork_file: ["files:write"],
  elnora_create_working_copy: ["files:write"],
  elnora_commit_working_copy: ["files:write"],
  elnora_initiate_upload: ["files:write"],
  elnora_confirm_upload: ["files:write"],

  // Projects
  elnora_list_projects: ["projects:read"],
  elnora_get_project: ["projects:read"],
  elnora_create_project: ["projects:write"],
  elnora_update_project: ["projects:write"],
  elnora_archive_project: ["projects:write"],
  elnora_list_project_members: ["projects:read"],
  elnora_add_project_member: ["projects:write"],
  elnora_update_project_member_role: ["projects:write"],
  elnora_remove_project_member: ["projects:write"],
  elnora_leave_project: ["projects:write"],

  // Search
  elnora_search_tasks: ["search:read"],
  elnora_search_files: ["search:read"],
  elnora_search_all: ["search:read"],

  // Organizations
  elnora_list_orgs: ["orgs:read"],
  elnora_get_org: ["orgs:read"],
  elnora_create_org: ["orgs:write"],
  elnora_update_org: ["orgs:write"],
  elnora_list_org_members: ["orgs:read"],
  elnora_update_org_member_role: ["orgs:write"],
  elnora_remove_org_member: ["orgs:write"],
  elnora_get_org_billing: ["orgs:read"],
  elnora_invite_org_member: ["orgs:write"],
  elnora_list_org_invitations: ["orgs:read"],
  elnora_cancel_org_invitation: ["orgs:write"],
  elnora_get_invitation_info: ["orgs:read"],
  elnora_accept_invitation: ["orgs:write"],

  // Folders
  elnora_list_folders: ["folders:read"],
  elnora_create_folder: ["folders:write"],
  elnora_rename_folder: ["folders:write"],
  elnora_move_folder: ["folders:write"],
  elnora_delete_folder: ["folders:write"],

  // Library
  elnora_list_library_files: ["library:read"],
  elnora_list_library_folders: ["library:read"],
  elnora_create_library_folder: ["library:write"],
  elnora_rename_library_folder: ["library:write"],
  elnora_delete_library_folder: ["library:write"],

  // API Keys
  elnora_list_api_keys: ["api-keys:read"],
  elnora_create_api_key: ["api-keys:write"],
  elnora_revoke_api_key: ["api-keys:write"],

  // Audit
  elnora_list_audit_log: ["audit:read"],

  // Account
  elnora_get_account: ["account:read"],
  elnora_update_account: ["account:write"],
  elnora_list_agreements: ["account:read"],
  elnora_accept_terms: ["account:write"],

  // Feedback
  elnora_submit_feedback: ["feedback:write"],

  // Protocol (convenience)
  elnora_generate_protocol: ["tasks:write", "messages:write"],

  // Flags & Health — no scopes required (public endpoints)
  elnora_list_flags: [],
  elnora_get_flag: [],
  elnora_health_check: [],
};

/**
 * Check if the given scopes satisfy the required scopes for a tool.
 * Returns the list of missing scopes, or empty array if all present.
 */
export function checkToolScopes(toolName: string, grantedScopes: string[]): string[] {
  const required = TOOL_SCOPES[toolName];
  if (!required) {
    // Deny-by-default: unknown tools must not bypass scope checks (CoSAI MCP-T2)
    return ["unknown_tool"];
  }
  // Empty array means no scopes required (e.g. health check) — always allowed
  return required.filter((s) => !grantedScopes.includes(s));
}
