export interface ElnoraConfig {
  apiUrl: string;
  authUrl: string;
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

export interface AuthContext {
  userId: number;
  organizationId: string;
  scopes: string;
  tokenType: string;
}

export interface ElnoraTask {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ElnoraMessage {
  id: string;
  taskId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  agentName?: string;
}

export interface ElnoraFile {
  id: string;
  name: string;
  fileType: string;
  visibility: string;
  createdAt: string;
  latestVersionId?: string;
}

export interface TokenValidationResult {
  valid: boolean;
  userId?: number;
  organizationId?: string;
  scopes?: string;
  tokenType?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
  nextOffset?: number;
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
