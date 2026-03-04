export const CHARACTER_LIMIT = 25000;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const REQUEST_TIMEOUT_MS = 30000;
export const LONG_REQUEST_TIMEOUT_MS = 120000;

// Auth constants
export const ACCESS_TOKEN_TTL_SECONDS = 3600; // 1 hour
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 3600; // 30 days
export const AUTH_CODE_TTL_SECONDS = 300; // 5 minutes
export const CLIENT_SECRET_TTL_SECONDS = 90 * 24 * 3600; // 90 days

// MCP scopes
export const SUPPORTED_SCOPES = [
  "tasks:read",
  "tasks:write",
  "files:read",
  "files:write",
  "messages:read",
  "messages:write",
] as const;
