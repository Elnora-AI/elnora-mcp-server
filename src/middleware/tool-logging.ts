/**
 * Structured auth event logger.
 * CoSAI MCP-T12: Log auth events for SIEM correlation.
 */
export function logAuthEvent(
  event: string,
  clientId: string,
  details?: Record<string, unknown>,
): void {
  const entry: Record<string, unknown> = {
    type: "auth_event",
    timestamp: new Date().toISOString(),
    event,
    clientId,
  };
  if (details) entry.details = details;
  console.error(JSON.stringify(entry));
}

/**
 * Structured rate limit event logger.
 */
export function logRateLimitEvent(
  key: string,
  count: number,
  limit: number,
): void {
  const entry = {
    type: "rate_limit_block",
    timestamp: new Date().toISOString(),
    key,
    count,
    limit,
  };
  console.error(JSON.stringify(entry));
}

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
const REDACT_CONTENT_KEYS = new Set(["content", "message", "description", "initial_message"]);
const REDACT_PII_KEYS = new Set(["email", "first_name", "last_name", "token"]);
const REDACT_ARRAY_KEYS = new Set(["file_ids", "context_file_ids", "scopes"]);

function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (REDACT_CONTENT_KEYS.has(key)) {
      sanitized[key] = typeof value === "string" ? `[${value.length} chars]` : typeof value;
    } else if (REDACT_PII_KEYS.has(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (REDACT_ARRAY_KEYS.has(key)) {
      sanitized[key] = Array.isArray(value) ? `[${value.length} items]` : typeof value;
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
