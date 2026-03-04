/**
 * Per-tool scope enforcement.
 * CoSAI MCP-T2: Least privilege — each tool declares required scopes.
 *
 * Scope mapping:
 * - elnora_list_tasks, elnora_get_task_messages → tasks:read
 * - elnora_create_task → tasks:write
 * - elnora_send_message → messages:write
 * - elnora_list_files, elnora_get_file_content → files:read
 * - elnora_upload_file → files:write
 * - elnora_generate_protocol → tasks:write, messages:write
 */
export const TOOL_SCOPES: Record<string, string[]> = {
  elnora_list_tasks: ["tasks:read"],
  elnora_get_task_messages: ["tasks:read"],
  elnora_create_task: ["tasks:write"],
  elnora_send_message: ["messages:write"],
  elnora_list_files: ["files:read"],
  elnora_get_file_content: ["files:read"],
  elnora_upload_file: ["files:write"],
  elnora_generate_protocol: ["tasks:write", "messages:write"],
};

/**
 * Check if the given scopes satisfy the required scopes for a tool.
 * Returns the list of missing scopes, or empty array if all present.
 */
export function checkToolScopes(toolName: string, grantedScopes: string[]): string[] {
  const required = TOOL_SCOPES[toolName];
  if (!required) return []; // Unknown tool — no scope check
  return required.filter((s) => !grantedScopes.includes(s));
}
