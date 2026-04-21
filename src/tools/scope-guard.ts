/**
 * Per-tool scope enforcement.
 * CoSAI MCP-T2: Least privilege — each tool declares required scopes.
 *
 * Keep aligned with elnora-cli command scopes (audit script enforces parity).
 */
export const TOOL_SCOPES: Record<string, string[]> = {
  // Health
  elnora_health_check: [],

  // Tasks (includes messaging)
  elnora_tasks_list: ["tasks:read"],
  elnora_tasks_get: ["tasks:read"],
  elnora_tasks_create: ["tasks:write"],
  elnora_tasks_send: ["messages:write"],
  elnora_tasks_messages: ["messages:read"],
  elnora_tasks_update: ["tasks:write"],
  elnora_tasks_archive: ["tasks:write"],

  // Files
  elnora_files_list: ["files:read"],
  elnora_files_get: ["files:read"],
  elnora_files_content: ["files:read"],
  elnora_files_create: ["files:write"],
  elnora_files_upload: ["files:write"],
  elnora_files_uploadBatch: ["files:write"],
  elnora_files_confirmUpload: ["files:write"],
  elnora_files_download: ["files:read"],
  elnora_files_update: ["files:write"],
  elnora_files_archive: ["files:write"],
  elnora_files_versions: ["files:read"],
  elnora_files_versionContent: ["files:read"],
  elnora_files_createVersion: ["files:write"],
  elnora_files_restore: ["files:write"],
  elnora_files_promote: ["files:write"],
  elnora_files_fork: ["files:write"],
  elnora_files_workingCopy: ["files:write"],
  elnora_files_commit: ["files:write"],
  elnora_files_searchContent: ["search:read"],

  // Projects
  elnora_projects_list: ["projects:read"],
  elnora_projects_get: ["projects:read"],
  elnora_projects_create: ["projects:write"],
  elnora_projects_update: ["projects:write"],
  elnora_projects_archive: ["projects:write"],
  elnora_projects_members: ["projects:read"],
  elnora_projects_addMember: ["projects:write"],
  elnora_projects_updateRole: ["projects:write"],
  elnora_projects_removeMember: ["projects:write"],
  elnora_projects_leave: ["projects:write"],

  // Orgs
  elnora_orgs_list: ["orgs:read"],
  elnora_orgs_get: ["orgs:read"],
  elnora_orgs_create: ["orgs:write"],
  elnora_orgs_update: ["orgs:write"],
  elnora_orgs_delete: ["orgs:write"],
  elnora_orgs_members: ["orgs:read"],
  elnora_orgs_updateRole: ["orgs:write"],
  elnora_orgs_removeMember: ["orgs:write"],
  elnora_orgs_billing: ["orgs:read"],
  elnora_orgs_setStripe: ["orgs:write"],
  elnora_orgs_setDefault: ["orgs:write"],
  elnora_orgs_invite: ["orgs:write"],
  elnora_orgs_invitations: ["orgs:read"],
  elnora_orgs_cancelInvite: ["orgs:write"],
  elnora_orgs_resendInvite: ["orgs:write"],
  elnora_orgs_invitationInfo: [],
  elnora_orgs_acceptInvite: ["orgs:write"],
  elnora_orgs_files: ["files:read"],
  elnora_orgs_listAll: ["orgs:read"],

  // Folders
  elnora_folders_list: ["folders:read"],
  elnora_folders_create: ["folders:write"],
  elnora_folders_rename: ["folders:write"],
  elnora_folders_move: ["folders:write"],
  elnora_folders_delete: ["folders:write"],

  // Search
  elnora_search_tasks: ["search:read"],
  elnora_search_files: ["search:read"],
  elnora_search_all: ["search:read"],
  elnora_search_fileContent: ["search:read"],

  // Library
  elnora_library_files: ["library:read"],
  elnora_library_folders: ["library:read"],
  elnora_library_createFolder: ["library:write"],
  elnora_library_renameFolder: ["library:write"],
  elnora_library_deleteFolder: ["library:write"],

  // Account
  elnora_account_get: ["account:read"],
  elnora_account_update: ["account:write"],
  elnora_account_agreements: ["account:read"],
  elnora_account_acceptTerms: ["account:write"],
  elnora_account_delete: ["account:write"],
  elnora_account_users: ["account:read"],
  elnora_account_addLegalDoc: ["account:write"],
  elnora_account_updateLegalDoc: ["account:write"],
  elnora_account_deleteLegalDoc: ["account:write"],

  // API Keys
  "elnora_api-keys_list": ["api-keys:read"],
  "elnora_api-keys_create": ["api-keys:write"],
  "elnora_api-keys_revoke": ["api-keys:write"],
  "elnora_api-keys_getPolicy": ["api-keys:read"],
  "elnora_api-keys_setPolicy": ["api-keys:write"],

  // Audit
  elnora_audit_list: ["audit:read"],

  // Feedback
  elnora_feedback_submit: ["feedback:write"],

  // Flags
  elnora_flags_list: [],
  elnora_flags_get: [],
  elnora_flags_set: ["flags:write"],

  // Protocols (aggregate)
  elnora_protocols_generate: ["tasks:write", "messages:write"],
};

/**
 * Check if the given scopes satisfy the required scopes for a tool.
 * Returns the list of missing scopes, or empty array if all present.
 */
export function checkToolScopes(toolName: string, grantedScopes: string[]): string[] {
  const required = TOOL_SCOPES[toolName];
  if (!required) {
    // Deny-by-default: unknown tools must not bypass scope checks (CoSAI MCP-T2)
    return [`tool_not_registered:${toolName}`];
  }
  // Empty array means no scopes required (e.g. health check) — always allowed
  return required.filter((s) => !grantedScopes.includes(s));
}
