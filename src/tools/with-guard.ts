import { RequestContext } from "../server.js";
import { checkToolScopes } from "./scope-guard.js";
import { logToolInvocation } from "../middleware/tool-logging.js";

/**
 * Wraps a tool handler with scope enforcement and invocation logging.
 * CoSAI MCP-T2 (scope enforcement) + MCP-T12 (audit logging).
 */
export function withGuard<T extends Record<string, unknown>>(
  toolName: string,
  getContext: () => RequestContext,
  handler: (params: T) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }>,
): (params: T) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  return async (params: T) => {
    const ctx = getContext();
    const start = Date.now();

    // Scope enforcement
    const missing = checkToolScopes(toolName, ctx.scopes);
    if (missing.length > 0) {
      logToolInvocation(toolName, params, ctx.clientId, { success: false, durationMs: Date.now() - start });
      return {
        content: [{
          type: "text" as const,
          text: `Error: Insufficient scope. Missing: ${missing.join(", ")}. Re-authenticate with the required scopes.`,
        }],
        isError: true,
      };
    }

    // Execute handler
    const result = await handler(params);
    logToolInvocation(toolName, params, ctx.clientId, {
      success: !result.isError,
      durationMs: Date.now() - start,
    });
    return result;
  };
}
