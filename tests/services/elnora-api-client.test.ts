import { describe, it, expect, vi, beforeEach } from "vitest";
import { ElnoraApiClient } from "../../src/services/elnora-api-client.js";

// Mock axios.create to capture config and return a mock instance
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
    })),
  },
}));

import axios from "axios";

describe("ElnoraApiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("sets Authorization header for bearer token auth", () => {
      new ElnoraApiClient({ apiUrl: "https://api.test.com" }, "my-bearer-token");

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: "https://api.test.com",
          headers: expect.objectContaining({
            Authorization: "Bearer my-bearer-token",
          }),
        }),
      );
    });

    it("sets X-API-Key header for API key auth", () => {
      new ElnoraApiClient({ apiUrl: "https://api.test.com" }, { apiKey: "elnora_live_abc123xyz" });

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-API-Key": "elnora_live_abc123xyz",
          }),
        }),
      );
    });

    it("does not set Authorization header for API key auth", () => {
      new ElnoraApiClient({ apiUrl: "https://api.test.com" }, { apiKey: "elnora_live_abc123xyz" });

      const headers = vi.mocked(axios.create).mock.calls[0][0]?.headers as Record<string, string>;
      expect(headers).not.toHaveProperty("Authorization");
    });
  });

  describe("get", () => {
    it("calls axios get with path and cleaned params", async () => {
      mockGet.mockResolvedValueOnce({ data: { tasks: [] } });
      const client = new ElnoraApiClient({ apiUrl: "https://api.test.com" }, "token");

      const result = await client.get("/tasks", { page: 1, status: undefined, pageSize: 25 });

      expect(mockGet).toHaveBeenCalledWith("/tasks", {
        params: { page: 1, pageSize: 25 },
      });
      expect(result).toEqual({ tasks: [] });
    });

    it("strips undefined params", async () => {
      mockGet.mockResolvedValueOnce({ data: {} });
      const client = new ElnoraApiClient({ apiUrl: "https://api.test.com" }, "token");

      await client.get("/tasks", { page: 1, status: undefined });

      const passedParams = mockGet.mock.calls[0][1].params;
      expect(passedParams).not.toHaveProperty("status");
    });
  });

  describe("post", () => {
    it("calls axios post with body and returns data", async () => {
      mockPost.mockResolvedValueOnce({ data: { id: "new-task-id" } });
      const client = new ElnoraApiClient({ apiUrl: "https://api.test.com" }, "token");

      const result = await client.post("/tasks", { title: "Test" });

      expect(mockPost).toHaveBeenCalledWith("/tasks", { title: "Test" }, undefined);
      expect(result).toEqual({ id: "new-task-id" });
    });

    it("passes custom timeout", async () => {
      mockPost.mockResolvedValueOnce({ data: {} });
      const client = new ElnoraApiClient({ apiUrl: "https://api.test.com" }, "token");

      await client.post("/tasks", { title: "Test" }, { timeout: 120000 });

      expect(mockPost).toHaveBeenCalledWith("/tasks", { title: "Test" }, { timeout: 120000 });
    });
  });

  describe("put", () => {
    it("calls axios put with body and returns data", async () => {
      mockPut.mockResolvedValueOnce({ data: { updated: true } });
      const client = new ElnoraApiClient({ apiUrl: "https://api.test.com" }, "token");

      const result = await client.put("/tasks/123", { title: "Updated" });

      expect(mockPut).toHaveBeenCalledWith("/tasks/123", { title: "Updated" });
      expect(result).toEqual({ updated: true });
    });
  });

  describe("del", () => {
    it("calls axios delete and returns data", async () => {
      mockDelete.mockResolvedValueOnce({ data: null });
      const client = new ElnoraApiClient({ apiUrl: "https://api.test.com" }, "token");

      const result = await client.del("/tasks/123");

      expect(mockDelete).toHaveBeenCalledWith("/tasks/123");
      expect(result).toBeNull();
    });
  });

  describe("sendMessage", () => {
    it("posts to /tasks/{id}/messages with long timeout", async () => {
      mockPost.mockResolvedValueOnce({ data: { response: "AI reply" } });
      const client = new ElnoraApiClient({ apiUrl: "https://api.test.com" }, "token");

      const result = await client.sendMessage("task-id", "Hello", ["file-1"]);

      expect(mockPost).toHaveBeenCalledWith(
        "/tasks/task-id/messages",
        { content: "Hello", fileIds: ["file-1"] },
        { timeout: 120000 },
      );
      expect(result).toEqual({ response: "AI reply" });
    });
  });

  describe("getFileContent", () => {
    it("gets file content by ID", async () => {
      mockGet.mockResolvedValueOnce({
        data: { content: "# Protocol", name: "test.md", fileType: "text/markdown" },
      });
      const client = new ElnoraApiClient({ apiUrl: "https://api.test.com" }, "token");

      const result = await client.getFileContent("file-id");

      expect(mockGet).toHaveBeenCalledWith("/files/file-id/content", { params: {} });
      expect(result).toEqual({ content: "# Protocol", name: "test.md", fileType: "text/markdown" });
    });
  });

  describe("uploadFile", () => {
    it("posts file with default MIME type", async () => {
      mockPost.mockResolvedValueOnce({ data: { id: "new-file-id" } });
      const client = new ElnoraApiClient({ apiUrl: "https://api.test.com" }, "token");

      const result = await client.uploadFile("test.md", "# Content");

      expect(mockPost).toHaveBeenCalledWith(
        "/files",
        { name: "test.md", content: "# Content", fileType: "text/markdown" },
        undefined,
      );
      expect(result).toEqual({ id: "new-file-id" });
    });

    it("uses custom MIME type when provided", async () => {
      mockPost.mockResolvedValueOnce({ data: { id: "new-file-id" } });
      const client = new ElnoraApiClient({ apiUrl: "https://api.test.com" }, "token");

      await client.uploadFile("data.json", "{}", "application/json");

      expect(mockPost).toHaveBeenCalledWith(
        "/files",
        { name: "data.json", content: "{}", fileType: "application/json" },
        undefined,
      );
    });
  });
});
