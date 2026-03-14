import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";
import { ElnoraConfig } from "../types.js";
import { REQUEST_TIMEOUT_MS, LONG_REQUEST_TIMEOUT_MS } from "../constants.js";

/** Minimum milliseconds between requests (prevents accidental DoS). */
const THROTTLE_MS = 100;

/** Maximum retries on 429 rate limit responses. */
const MAX_RETRIES = 3;

/** Base delay for exponential backoff (ms). Doubles each retry: 1s, 2s, 4s. */
const BACKOFF_BASE_MS = 1000;

/**
 * Allowed API hostnames. Requests to any other host are blocked (SSRF prevention).
 * Localhost is allowed in development only.
 */
const ALLOWED_HOSTNAMES = new Set(["platform.elnora.ai"]);
const DEV_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

export class ElnoraApiClient {
  private client: AxiosInstance;
  private originUrl: string;
  private orgId?: string;
  private lastRequestTime = 0;

  constructor(config: Pick<ElnoraConfig, "apiUrl">, auth: string | { apiKey: string }) {
    // Validate base URL hostname (SSRF prevention — CoSAI MCP-T7)
    const parsed = new URL(config.apiUrl);
    this.validateHostname(parsed.hostname);
    // Block URL userinfo (user:pass@host) — potential credential leak
    if (parsed.username || parsed.password) {
      throw new Error("API URL must not contain credentials in the URL.");
    }

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
      // SSRF: limit redirects to same-origin only
      maxRedirects: 3,
      beforeRedirect: (options: Record<string, unknown>) => {
        const redirectUrl = new URL(options.href as string);
        if (!ALLOWED_HOSTNAMES.has(redirectUrl.hostname) && !DEV_HOSTNAMES.has(redirectUrl.hostname)) {
          throw new Error(`Blocked redirect to untrusted host: ${redirectUrl.hostname}`);
        }
      },
    });
  }

  // --- Hostname validation ---

  private validateHostname(hostname: string): void {
    if (ALLOWED_HOSTNAMES.has(hostname)) return;
    const env = process.env.NODE_ENV;
    if (DEV_HOSTNAMES.has(hostname) && env !== "production") return;
    // Allow test hostnames in test/development environments
    if (env === "test" || env === "development") return;
    throw new Error(`Blocked request to untrusted host: ${hostname}. Only ${[...ALLOWED_HOSTNAMES].join(", ")} allowed.`);
  }

  // --- Org context ---

  /** Set the organization context for subsequent requests (adds X-Organization-Id header). */
  setOrgContext(orgId: string): void {
    this.orgId = orgId;
  }

  private get orgHeaders(): Record<string, string> {
    if (this.orgId) return { "X-Organization-Id": this.orgId };
    return {};
  }

  // --- Throttle ---

  /** Enforce minimum delay between requests to prevent accidental DoS. */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < THROTTLE_MS) {
      await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  // --- Retry with exponential backoff ---

  /**
   * Execute a request function with automatic retry on 429 rate limit.
   * Respects Retry-After header when present.
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.throttle();
        return await fn();
      } catch (error) {
        lastError = error;
        if (!axios.isAxiosError(error) || error.response?.status !== 429) {
          throw error; // Not a rate limit — don't retry
        }
        if (attempt === MAX_RETRIES) break;

        // Calculate delay: use Retry-After header or exponential backoff
        const retryAfter = error.response?.headers?.["retry-after"];
        let delayMs: number;
        if (retryAfter) {
          const parsed = parseInt(retryAfter, 10);
          delayMs = isNaN(parsed) ? BACKOFF_BASE_MS * Math.pow(2, attempt) : parsed * 1000;
        } else {
          delayMs = BACKOFF_BASE_MS * Math.pow(2, attempt); // 1s, 2s, 4s
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw lastError;
  }

  // --- Generic HTTP helpers (used by tools) ---

  async get<T = unknown>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const cleaned: Record<string, string | number> = {};
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) cleaned[k] = v;
      }
    }
    return this.withRetry(async () => {
      const response = await this.client.get<T>(path, { params: cleaned, headers: this.orgHeaders });
      return response.data;
    });
  }

  async post<T = unknown>(path: string, body?: unknown, options?: { timeout?: number }): Promise<T> {
    return this.withRetry(async () => {
      const response = await this.client.post<T>(path, body, {
        ...options ? { timeout: options.timeout } : {},
        headers: this.orgHeaders,
      });
      return response.data;
    });
  }

  async put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.withRetry(async () => {
      const response = await this.client.put<T>(path, body, { headers: this.orgHeaders });
      return response.data;
    });
  }

  async del<T = unknown>(path: string): Promise<T> {
    return this.withRetry(async () => {
      const response = await this.client.delete<T>(path, { headers: this.orgHeaders });
      return response.data;
    });
  }

  /** Hit root-level /health (not under /api/v1). */
  async healthCheck(): Promise<unknown> {
    return this.withRetry(async () => {
      const response = await this.client.get<unknown>(`${this.originUrl}/health`, { timeout: REQUEST_TIMEOUT_MS });
      return response.data;
    });
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
