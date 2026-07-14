import { describe, it, expect, vi } from "vitest";
import { createElnoraServer, RequestContext } from "../../src/server.js";
import { ALL_SCOPES } from "../../src/constants.js";
import type { ElnoraApiClient } from "../../src/services/elnora-api-client.js";

// KB Access V2 sharing/move tools (ELN-977) must hit the closure-table controller
// paths with the right verb: share=POST, unshare=DELETE, shares=GET, move=PATCH.

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

const FILE_ID = "d5c4b3a2-f6e5-4b7a-9d8c-1f0e2a3b4c5d";
const FOLDER_ID = "c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f";
const ACE_ID = "e5f6a7b8-c9d0-4e1f-9a2b-3c4d5e6f7a8b";
const ORG_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

describe("File sharing tools", () => {
  it("elnora_files_move → PATCH /files/{id}/move", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_files_move", { fileId: FILE_ID, parentFolderId: FOLDER_ID });
    expect(client.patch).toHaveBeenCalledWith(`/files/${FILE_ID}/move`, { parentFolderId: FOLDER_ID });
  });

  it("elnora_files_share (user) → POST /files/{id}/share with userId", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_files_share", { fileId: FILE_ID, userId: 42, orgWide: false, role: "editor" });
    expect(client.post).toHaveBeenCalledWith(`/files/${FILE_ID}/share`, { userId: 42, role: "editor" });
  });

  it("elnora_files_share (org-wide) → POST /files/{id}/share with isOrgWide", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_files_share", { fileId: FILE_ID, orgWide: true, role: "viewer" });
    expect(client.post).toHaveBeenCalledWith(`/files/${FILE_ID}/share`, { isOrgWide: true, role: "viewer" });
  });

  it("elnora_files_share rejects both user and org-wide (no HTTP call)", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    const result = (await invoke("elnora_files_share", {
      fileId: FILE_ID,
      userId: 42,
      orgWide: true,
      role: "editor",
    })) as { isError?: boolean };
    expect(result.isError).toBe(true);
    expect(client.post).not.toHaveBeenCalled();
  });

  it("elnora_files_unshare → DELETE /files/{id}/share/{aceId}", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_files_unshare", { fileId: FILE_ID, aceId: ACE_ID });
    expect(client.del).toHaveBeenCalledWith(`/files/${FILE_ID}/share/${ACE_ID}`);
  });

  it("elnora_files_shares → GET /files/{id}/shares", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_files_shares", { fileId: FILE_ID });
    expect(client.get).toHaveBeenCalledWith(`/files/${FILE_ID}/shares`);
  });
});

describe("Folder sharing tools", () => {
  it("elnora_folders_share (user) → POST /folders/{id}/share", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_folders_share", { folderId: FOLDER_ID, userId: 7, orgWide: false, role: "admin" });
    expect(client.post).toHaveBeenCalledWith(`/folders/${FOLDER_ID}/share`, { userId: 7, role: "admin" });
  });

  it("elnora_folders_unshare → DELETE /folders/{id}/share/{aceId}", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_folders_unshare", { folderId: FOLDER_ID, aceId: ACE_ID });
    expect(client.del).toHaveBeenCalledWith(`/folders/${FOLDER_ID}/share/${ACE_ID}`);
  });

  it("elnora_folders_shares → GET /folders/{id}/shares", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_folders_shares", { folderId: FOLDER_ID });
    expect(client.get).toHaveBeenCalledWith(`/folders/${FOLDER_ID}/shares`);
  });
});

describe("Org member directory tool", () => {
  it("elnora_orgs_directory → GET /organizations/{id}/members/directory?q=", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_orgs_directory", { orgId: ORG_ID, query: "ada" });
    expect(client.get).toHaveBeenCalledWith(`/organizations/${ORG_ID}/members/directory`, { q: "ada" });
  });
});
