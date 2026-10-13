export interface ElnoraConfig {
  apiUrl: string;
  tokenValidationUrl: string;
  port: number;
  /** Public-facing base URL of the MCP server (e.g. https://mcp.elnora.ai) */
  publicUrl: string;
  /** URL of the Elnora platform login page */
  loginUrl: string;
  /** URL to exchange platform auth codes for platform tokens */
  tokenExchangeUrl: string;
  /** Client ID for the MCP server as an OAuth client of the Elnora platform */
  platformClientId: string;
  /** Client secret for the MCP server as an OAuth client of the Elnora platform */
  platformClientSecret: string;
  /** Service key for authenticating to the platform's token validation endpoint */
  mcpServiceKey: string;
  /** Redis connection URL (e.g. redis://localhost:6379 or rediss://... for TLS) */
  redisUrl: string;
  /**
   * When true, non-loopback (hosted) OAuth clients may register and, after passing the per-client
   * consent screen, complete the authorization flow. When false (default) only loopback clients are
   * allowed, everywhere — the pre-consent containment behaviour. Sourced from
   * ELNORA_MCP_ALLOW_HOSTED_CLIENTS.
   */
  allowHostedClients: boolean;
}

/** Stored authorization session for PKCE flow */
export interface AuthorizationSession {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  scopes: string[];
  state?: string;
  resource?: string;
  platformCode?: string;
  /** Random state token sent to platform login — verified on callback (CSRF protection) */
  platformState: string;
  /** One-time value bound to the initiating user agent via a cookie — verified on callback (RFC 9700) */
  browserBinding: string;
  /**
   * Whether the user has approved this client on the consent screen. Loopback clients are set true at
   * /authorize (no screen). Non-loopback clients start false and are flipped to true only by an
   * explicit Allow. The callback refuses to deliver a code to a non-loopback redirect unless this is
   * true. Absent (undefined) on pre-consent sessions and treated as "not consented" for non-loopback.
   */
  consented?: boolean;
  createdAt: number;
}

/** Stored token mapping */
export interface TokenRecord {
  accessToken: string;
  refreshToken: string;
  platformToken: string;
  platformRefreshToken?: string;
  clientId: string;
  scopes: string[];
  resource?: string;
  expiresAt: number;
  createdAt: number;
}
