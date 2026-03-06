import axios, { AxiosInstance } from "axios";
import { ElnoraConfig } from "../types.js";
import { REQUEST_TIMEOUT_MS, LONG_REQUEST_TIMEOUT_MS } from "../constants.js";

export class ElnoraApiClient {
  private client: AxiosInstance;
  private originUrl: string;

  constructor(config: Pick<ElnoraConfig, "apiUrl">, auth: string | { apiKey: string }) {
    // Derive origin (scheme + host) for root-level endpoints like /health
    const parsed = new URL(config.apiUrl);
    this.originUrl = parsed.origin;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (typeof auth === "string") {
      // Bearer token (OAuth flow)
      headers["Authorization"] = `Bearer ${auth}`;
    } else {
      // API key (direct auth)
      headers["X-API-Key"] = auth.apiKey;
    }

    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: REQUEST_TIMEOUT_MS,
      headers,
    });
  }

  // --- Generic HTTP helpers (used by new tools) ---

  async get<T = unknown>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const cleaned: Record<string, string | number> = {};
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) cleaned[k] = v;
      }
    }
    const response = await this.client.get<T>(path, { params: cleaned });
    return response.data;
  }

  async post<T = unknown>(path: string, body?: unknown, options?: { timeout?: number }): Promise<T> {
    const response = await this.client.post<T>(path, body, options ? { timeout: options.timeout } : undefined);
    return response.data;
  }

  async put<T = unknown>(path: string, body?: unknown): Promise<T> {
    const response = await this.client.put<T>(path, body);
    return response.data;
  }

  async del<T = unknown>(path: string): Promise<T> {
    const response = await this.client.delete<T>(path);
    return response.data;
  }

  /** Hit root-level /health (not under /api/v1). */
  async healthCheck(): Promise<unknown> {
    const response = await this.client.get<unknown>(`${this.originUrl}/health`, { timeout: REQUEST_TIMEOUT_MS });
    return response.data;
  }

  // --- Convenience methods used by tool handlers ---

  async sendMessage(taskId: string, content: string, fileIds?: string[]): Promise<unknown> {
    return this.post(`/tasks/${taskId}/messages`, { content, fileIds }, { timeout: LONG_REQUEST_TIMEOUT_MS });
  }

  async getFileContent(fileId: string): Promise<{ content: string; name: string; fileType: string }> {
    return this.get(`/files/${fileId}/content`);
  }

  async uploadFile(name: string, content: string, fileType?: string): Promise<unknown> {
    return this.post("/files/content", { name, content, fileType: fileType || "text/markdown" });
  }
}
