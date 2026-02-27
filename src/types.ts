export interface ElnoraConfig {
  apiUrl: string;
  authUrl: string;
  tokenValidationUrl: string;
  port: number;
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
