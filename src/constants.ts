export const CHARACTER_LIMIT = 100_000;
export const REQUEST_TIMEOUT_MS = 30_000;
export const LONG_REQUEST_TIMEOUT_MS = 120_000;

// Auth constants
export const ACCESS_TOKEN_TTL_SECONDS = 3600; // 1 hour
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 3600; // 30 days
export const AUTH_CODE_TTL_SECONDS = 300; // 5 minutes
// Authorization sessions that must pass through the consent screen get a longer lifetime than the
// bare auth-code TTL: the window has to cover reading the consent page plus the platform login
// (including credentials / 2FA) before the callback lands. Loopback flows keep AUTH_CODE_TTL_SECONDS.
export const CONSENT_SESSION_TTL_SECONDS = 600; // 10 minutes
export const CLIENT_SECRET_TTL_SECONDS = 90 * 24 * 3600; // 90 days

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
  "review:read",
  "review:write",
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
export type SupportedScope = (typeof SUPPORTED_SCOPES)[number];
export const ALL_SCOPES: SupportedScope[] = [...SUPPORTED_SCOPES];

/**
 * Human-readable descriptions shown on the consent screen, one per supported scope.
 * Framed from the user's perspective ("View your …") so a person approving a connection
 * understands what the application is asking for.
 */
export const SCOPE_DESCRIPTIONS: Record<string, string> = {
  "tasks:read": "View your tasks and their messages",
  "tasks:write": "Create and modify your tasks",
  "files:read": "View and download your files",
  "files:write": "Create, modify, and delete your files",
  "messages:read": "Read messages in your tasks",
  "messages:write": "Send messages in your tasks",
  "projects:read": "View your projects",
  "projects:write": "Create and modify projects, and manage members",
  "search:read": "Search your tasks and files",
  "orgs:read": "View your organizations and their members",
  "orgs:write": "Manage your organizations, members, and billing",
  "folders:read": "View your folders",
  "folders:write": "Create, modify, and delete your folders",
  "review:read": "View the knowledge-base review queue",
  "review:write": "Approve or reject knowledge-base submissions",
  "library:read": "View the shared library",
  "library:write": "Modify the shared library",
  "api-keys:read": "View your API keys",
  "api-keys:write": "Create and revoke API keys",
  "audit:read": "View your audit log",
  "account:read": "View your account profile",
  "account:write": "Modify your account, including deleting it",
  "feedback:write": "Submit feedback",
};

/**
 * Scopes that grant the ability to change state. Surfaced with a warning on the consent screen so a
 * user notices when an application asks for more than read access. (Hosted clients are currently
 * capped to read-only — see HOSTED_CLIENT_ALLOWED_SCOPES — so this is defense-in-depth.)
 */
export const SENSITIVE_SCOPES: ReadonlySet<string> = new Set(
  SUPPORTED_SCOPES.filter((s) => s.endsWith(":write")),
);

/**
 * Scopes a non-loopback (hosted) client may obtain today — an explicit read-only allowlist. It lets us
 * re-enable hosted connectors (e.g. claude.ai) behind the consent screen without a hosted client being
 * able to request mutation, or to read security-sensitive data (API-key inventory, the audit log),
 * that a mis-click could grant. Scopes requested beyond this set are dropped, never escalated. A
 * richer per-client registration cap is a planned follow-up; widening this set is a one-line change.
 *
 * projects:read is intentionally excluded: the platform removed the "project" concept, so every
 * projects tool is a no-op and the consent screen must not offer "View your projects".
 */
export const HOSTED_CLIENT_ALLOWED_SCOPES: ReadonlySet<string> = new Set([
  "tasks:read",
  "files:read",
  "messages:read",
  "search:read",
  "orgs:read",
  "folders:read",
  "review:read",
  "library:read",
  "account:read",
]);
