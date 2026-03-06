import { RequestContext } from "../server.js";
import { checkToolScopes, TOOL_SCOPES } from "./scope-guard.js";
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
    const requiredScopes = TOOL_SCOPES[toolName];

    // Deny-by-default: reject unregistered tools before touching auth context
    if (requiredScopes === undefined) {
      logToolInvocation(toolName, params, "unknown", { success: false, durationMs: 0 });
      return {
        content: [{
          type: "text" as const,
          text: `Error: Insufficient scope. Missing: tool_not_registered:${toolName}. Re-authenticate with the required scopes.`,
        }],
        isError: true,
      };
    }

    const isPublic = requiredScopes.length === 0;

    // Public tools (empty required scopes) skip auth context entirely
    if (isPublic) {
      const start = Date.now();
      try {
        const result = await handler(params);
        logToolInvocation(toolName, params, "anonymous", {
          success: !result.isError,
          durationMs: Date.now() - start,
        });
        return result;
      } catch (error) {
        logToolInvocation(toolName, params, "anonymous", {
          success: false,
          durationMs: Date.now() - start,
        });
        return {
          content: [{
            type: "text" as const,
            text: `Error: Unexpected error in ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    }

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
    try {
      const result = await handler(params);
      logToolInvocation(toolName, params, ctx.clientId, {
        success: !result.isError,
        durationMs: Date.now() - start,
      });
      return result;
    } catch (error) {
      logToolInvocation(toolName, params, ctx.clientId, {
        success: false,
        durationMs: Date.now() - start,
      });
      return {
        content: [{
          type: "text" as const,
          text: `Error: Unexpected error in ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  };
}
