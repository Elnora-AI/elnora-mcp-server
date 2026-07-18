import { describe, it, expect, vi } from "vitest";
import { createElnoraServer, RequestContext } from "../../src/server.js";
import { ALL_SCOPES } from "../../src/constants.js";
import type { ElnoraApiClient } from "../../src/services/elnora-api-client.js";

// Folder mutation tools default to the closure-table KB controller (create=POST /folders,
// rename=PATCH /folders/{id}, move=PATCH /folders/{id}/move, delete=POST /folders/{id}/archive)
// and fall back to the deprecated project-scoped controller only when legacy/project is set.

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

const FOLDER_ID = "c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f";
const PARENT_ID = "d5c4b3a2-f6e5-4b7a-9d8c-1f0e2a3b4c5d";
const PROJECT_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

describe("elnora_folders_create", () => {
  it("defaults to POST /folders (KB)", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_folders_create", { name: "New" });
    expect(client.post).toHaveBeenCalledWith(`/folders`, { name: "New" });
  });

  it("includes parentFolderId when parentId is provided", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_folders_create", { name: "Sub", parentId: PARENT_ID });
    expect(client.post).toHaveBeenCalledWith(`/folders`, { name: "Sub", parentFolderId: PARENT_ID });
  });

  it("no-ops the legacy project path (projects removed; no backend call)", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    const result = await invoke("elnora_folders_create", { name: "Leg", project: PROJECT_ID });
    expect(client.post).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).toContain("deprecated");
  });
});

describe("elnora_folders_rename", () => {
  it("defaults to PATCH /folders/{id} (KB)", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_folders_rename", { folderId: FOLDER_ID, name: "R" });
    expect(client.patch).toHaveBeenCalledWith(`/folders/${FOLDER_ID}`, { name: "R" });
  });

  it("uses PUT for legacy", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_folders_rename", { folderId: FOLDER_ID, name: "R", legacy: true });
    expect(client.put).toHaveBeenCalledWith(`/folders/${FOLDER_ID}`, { name: "R" });
  });
});

describe("elnora_folders_move", () => {
  it("PATCH /folders/{id}/move with parentFolderId for a parent", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_folders_move", { folderId: FOLDER_ID, parentId: PARENT_ID });
    expect(client.patch).toHaveBeenCalledWith(`/folders/${FOLDER_ID}/move`, { parentFolderId: PARENT_ID });
  });

  it("PATCH /folders/{id} with moveToRoot when parentId omitted", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_folders_move", { folderId: FOLDER_ID });
    expect(client.patch).toHaveBeenCalledWith(`/folders/${FOLDER_ID}`, { moveToRoot: true });
  });

  it("legacy uses PUT /folders/{id}/move with newParentFolderId", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_folders_move", { folderId: FOLDER_ID, parentId: PARENT_ID, legacy: true });
    expect(client.put).toHaveBeenCalledWith(`/folders/${FOLDER_ID}/move`, { newParentFolderId: PARENT_ID });
  });

  it("legacy move with parentId omitted sends null newParentFolderId", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_folders_move", { folderId: FOLDER_ID, legacy: true });
    expect(client.put).toHaveBeenCalledWith(`/folders/${FOLDER_ID}/move`, { newParentFolderId: null });
  });
});

describe("elnora_folders_delete", () => {
  it("archives (POST /folders/{id}/archive) by default", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_folders_delete", { folderId: FOLDER_ID });
    expect(client.post).toHaveBeenCalledWith(`/folders/${FOLDER_ID}/archive`, {});
  });

  it("hard-deletes (DELETE /folders/{id}) for legacy", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_folders_delete", { folderId: FOLDER_ID, legacy: true });
    expect(client.del).toHaveBeenCalledWith(`/folders/${FOLDER_ID}`);
  });
});
