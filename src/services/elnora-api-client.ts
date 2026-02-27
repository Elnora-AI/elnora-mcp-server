import axios, { AxiosInstance } from "axios";
import { ElnoraConfig, ElnoraTask, ElnoraMessage, ElnoraFile, TokenValidationResult } from "../types.js";
import { REQUEST_TIMEOUT_MS, LONG_REQUEST_TIMEOUT_MS } from "../constants.js";

export class ElnoraApiClient {
  private client: AxiosInstance;
  private tokenValidationUrl: string;

  constructor(config: ElnoraConfig, private bearerToken: string) {
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${bearerToken}`,
      },
    });
    this.tokenValidationUrl = config.tokenValidationUrl;
  }

  // --- Token Validation ---

  static async validateToken(tokenValidationUrl: string, token: string): Promise<TokenValidationResult> {
    const response = await axios.post<TokenValidationResult>(
      tokenValidationUrl,
      { token },
      { timeout: REQUEST_TIMEOUT_MS },
    );
    return response.data;
  }

  // --- Tasks ---

  async createTask(title?: string): Promise<ElnoraTask> {
    const response = await this.client.post<ElnoraTask>("/tasks", {
      title: title || "New Task",
    });
    return response.data;
  }

  async listTasks(
    status?: string,
    limit = 20,
    offset = 0,
  ): Promise<{ items: ElnoraTask[]; totalCount: number }> {
    const params: Record<string, string | number> = { limit, offset };
    if (status) params.status = status;
    const response = await this.client.get("/tasks", { params });
    return response.data;
  }

  async getTaskMessages(
    taskId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ items: ElnoraMessage[]; totalCount: number }> {
    const response = await this.client.get(`/tasks/${taskId}/messages`, {
      params: { limit, offset },
    });
    return response.data;
  }

  // --- Messages ---

  async sendMessage(taskId: string, content: string, fileIds?: string[]): Promise<ElnoraMessage> {
    const response = await this.client.post<ElnoraMessage>(
      `/tasks/${taskId}/messages`,
      { content, fileIds },
      { timeout: LONG_REQUEST_TIMEOUT_MS },
    );
    return response.data;
  }

  // --- Files ---

  async listFiles(
    projectId?: string,
    limit = 20,
    offset = 0,
  ): Promise<{ items: ElnoraFile[]; totalCount: number }> {
    const params: Record<string, string | number> = { limit, offset };
    if (projectId) params.projectId = projectId;
    const response = await this.client.get("/files", { params });
    return response.data;
  }

  async getFileContent(fileId: string): Promise<{ content: string; name: string; fileType: string }> {
    const response = await this.client.get(`/files/${fileId}/content`);
    return response.data;
  }

  async uploadFile(name: string, content: string, fileType?: string): Promise<ElnoraFile> {
    const response = await this.client.post<ElnoraFile>("/files", {
      name,
      content,
      fileType: fileType || "text/markdown",
    });
    return response.data;
  }
}
