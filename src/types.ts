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
  createdAt: number;
}

/** Stored token mapping */
export interface TokenRecord {
  accessToken: string;
  refreshToken: string;
  platformToken: string;
  clientId: string;
  scopes: string[];
  resource?: string;
  expiresAt: number;
  createdAt: number;
}
