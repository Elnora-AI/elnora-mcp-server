export const CHARACTER_LIMIT = 100_000;
export const REQUEST_TIMEOUT_MS = 30_000;
export const LONG_REQUEST_TIMEOUT_MS = 120_000;

// Auth constants
export const ACCESS_TOKEN_TTL_SECONDS = 3600; // 1 hour
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 3600; // 30 days
export const AUTH_CODE_TTL_SECONDS = 300; // 5 minutes
export const CLIENT_SECRET_TTL_SECONDS = 90 * 24 * 3600; // 90 days

// API key validation
export const API_KEY_PREFIX = "elnora_live_";
export const API_KEY_MIN_LENGTH = 20;

// MCP scopes — all supported scopes for OAuth clients
export const SUPPORTED_SCOPES = [
  "tasks:read",
  "tasks:write",
  "files:read",
  "files:write",
  "messages:read",
  "messages:write",
  "projects:read",
  "projects:write",
  "search:read",
  "orgs:read",
  "orgs:write",
  "folders:read",
  "folders:write",
  "library:read",
  "library:write",
  "api-keys:read",
  "api-keys:write",
  "audit:read",
  "account:read",
  "account:write",
  "feedback:write",
] as const;

// All scopes — used for API key auth (API keys get full access)
export const ALL_SCOPES = [...SUPPORTED_SCOPES] as string[];
