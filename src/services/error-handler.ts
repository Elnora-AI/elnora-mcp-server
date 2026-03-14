import axios from "axios";

/**
 * Patterns that match API keys and long token-like strings.
 * Scrubbed from all error output to prevent credential leaks.
 */
const CREDENTIAL_PATTERNS = [
  /elnora_live_[A-Za-z0-9_-]{10,}/g,
  /ELNORA_API_KEY=[^\s&]+/gi,
  /ELNORA_MCP_API_KEY=[^\s&]+/gi,
  /Bearer\s+[A-Za-z0-9._-]{20,}/g,
  /X-API-Key:\s*[^\s]+/gi,
  // Catch generic hex token-like strings (40+ hex chars, e.g. SHA tokens)
  /\b[0-9a-f]{40,}\b/gi,
];

/**
 * Scrub potential credentials from error messages.
 * Replaces API keys, bearer tokens, and long token-like strings with [REDACTED].
 */
function scrubCredentials(message: string): string {
  let scrubbed = message;
  for (const pattern of CREDENTIAL_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    scrubbed = scrubbed.replace(pattern, "[REDACTED]");
  }
  return scrubbed;
}

export function handleApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as { messages?: string[] } | undefined;
      const rawMessages = data?.messages?.join(", ") || "";
      const messages = scrubCredentials(rawMessages);

      switch (status) {
        case 400:
          return `Error: Invalid request. ${messages || "Check your parameters."}`;
        case 401:
          return "Error: Authentication failed. Your token may have expired — re-authenticate.";
        case 403:
          return "Error: Permission denied. You don't have access to this resource.";
        case 404:
          return `Error: Resource not found. ${messages || "Check the ID is correct."}`;
        case 429:
          return "Error: Rate limit exceeded. Please wait before making more requests.";
        default:
          return `Error: API request failed (${status}). ${messages}`;
      }
    } else if (error.code === "ECONNABORTED") {
      return "Error: Request timed out. The operation may still be in progress.";
    } else if (error.code === "ECONNREFUSED") {
      return "Error: Service temporarily unavailable. Please try again later.";
    } else if (error.code === "ECONNRESET") {
      return "Error: Connection was reset. The server may have dropped the connection — try again.";
    }
  }

  const rawMessage = error instanceof Error ? error.message : String(error);
  return `Error: Unexpected error: ${scrubCredentials(rawMessage)}`;
}
