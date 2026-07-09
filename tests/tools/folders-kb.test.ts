import { describe, it, expect, vi } from "vitest";
import { createElnoraServer, RequestContext } from "../../src/server.js";
import { ALL_SCOPES } from "../../src/constants.js";
import type { ElnoraApiClient } from "../../src/services/elnora-api-client.js";

// The Knowledge Base folder read tools (roots/children/get/files) must call the
// closure-table controller paths, not the legacy project-scoped ones.

function makeServerWithSpyClient() {
  const client = {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    del: vi.fn().mockResolvedValue({}),
  } as unknown as ElnoraApiClient;
  const ctx: RequestContext = { client, clientId: "test", scopes: ALL_SCOPES };
  const server = createElnoraServer(() => ctx);
  const tools = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown, extra: unknown) => unknown }> })._registeredTools;
  const invoke = (name: string, args: Record<string, unknown>) => tools[name].handler(args, {});
  return { client, invoke };
}

const FOLDER_ID = "d5c4b3a2-f6e5-4b7a-9d8c-1f0e2a3b4c5d";

describe("KB folder read tools", () => {
  it("elnora_folders_roots → GET /folders/roots", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_folders_roots", {});
    expect(client.get).toHaveBeenCalledWith("/folders/roots");
  });

  it("elnora_folders_children → GET /folders/{id}/children", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_folders_children", { folderId: FOLDER_ID });
    expect(client.get).toHaveBeenCalledWith(`/folders/${FOLDER_ID}/children`);
  });

  it("elnora_folders_get → GET /folders/{id}", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_folders_get", { folderId: FOLDER_ID });
    expect(client.get).toHaveBeenCalledWith(`/folders/${FOLDER_ID}`);
  });

  it("elnora_folders_files → GET /folders/{id}/files with pagination", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_folders_files", { folderId: FOLDER_ID, page: 1, pageSize: 25 });
    expect(client.get).toHaveBeenCalledWith(`/folders/${FOLDER_ID}/files`, { page: 1, pageSize: 25 });
  });
});
