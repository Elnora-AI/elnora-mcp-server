/**
 * Tool invocation audit logger.
 * CoSAI MCP-T12: Log every tool call with tool name, parameters, user ID, timestamp.
 *
 * Logs are written to stderr (structured JSON) for collection by CloudWatch/Datadog/etc.
 */
export function logToolInvocation(
  toolName: string,
  params: Record<string, unknown>,
  clientId: string,
  result: { success: boolean; durationMs: number },
): void {
  const entry = {
    type: "tool_invocation",
    timestamp: new Date().toISOString(),
    tool: toolName,
    clientId,
    params: sanitizeParams(params),
    success: result.success,
    durationMs: result.durationMs,
  };

  console.error(JSON.stringify(entry));
}

/**
 * Redact sensitive parameter values from logs.
 * Keep keys and value types visible for debugging, but mask actual content
 * for fields that might contain user data.
 */
function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key === "content" || key === "message") {
      // Log length instead of content to avoid PII in logs
      sanitized[key] = typeof value === "string" ? `[${value.length} chars]` : typeof value;
    } else if (key === "file_ids") {
      sanitized[key] = Array.isArray(value) ? `[${value.length} ids]` : typeof value;
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
