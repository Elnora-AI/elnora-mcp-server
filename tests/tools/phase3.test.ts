import { describe, it, expect, vi } from "vitest";
import { createElnoraServer, RequestContext } from "../../src/server.js";
import { ALL_SCOPES } from "../../src/constants.js";
import type { ElnoraApiClient } from "../../src/services/elnora-api-client.js";

// Phase 3: KB review queue, org auto-tidy, and task lifecycle (unarchive/attachments/status).

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

const ITEM_ID = "d5c4b3a2-f6e5-4b7a-9d8c-1f0e2a3b4c5d";
const ORG_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const TASK_ID = "c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f";
const ATT_ID = "e5f6a7b8-c9d0-4e1f-9a2b-3c4d5e6f7a8b";

describe("KB review tools", () => {
  it("elnora_review_list defaults to pending", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_review_list", { status: "pending" });
    expect(client.get).toHaveBeenCalledWith(`/kb-review-items`, { status: "pending" });
  });

  it("elnora_review_list maps 'all' to an empty status", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_review_list", { status: "all" });
    expect(client.get).toHaveBeenCalledWith(`/kb-review-items`, { status: "" });
  });

  it("elnora_review_approve → POST .../approve", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_review_approve", { itemId: ITEM_ID });
    expect(client.post).toHaveBeenCalledWith(`/kb-review-items/${ITEM_ID}/approve`, {});
  });

  it("elnora_review_reject → POST .../reject", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_review_reject", { itemId: ITEM_ID });
    expect(client.post).toHaveBeenCalledWith(`/kb-review-items/${ITEM_ID}/reject`, {});
  });
});

describe("org auto-tidy tool", () => {
  it("elnora_orgs_setAutotidy → PATCH /organizations/{id}/kb-autotidy", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_orgs_setAutotidy", { orgId: ORG_ID, enabled: true });
    expect(client.patch).toHaveBeenCalledWith(`/organizations/${ORG_ID}/kb-autotidy`, { enabled: true });
  });
});

describe("task lifecycle tools", () => {
  it("elnora_tasks_unarchive → POST /tasks/{id}/unarchive", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_tasks_unarchive", { taskId: TASK_ID });
    expect(client.post).toHaveBeenCalledWith(`/tasks/${TASK_ID}/unarchive`, {});
  });

  it("elnora_tasks_attachments → GET /tasks/{id}/attachments", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_tasks_attachments", { taskId: TASK_ID });
    expect(client.get).toHaveBeenCalledWith(`/tasks/${TASK_ID}/attachments`);
  });

  it("elnora_tasks_attachmentContent → GET .../content", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_tasks_attachmentContent", { taskId: TASK_ID, attachmentId: ATT_ID });
    expect(client.get).toHaveBeenCalledWith(`/tasks/${TASK_ID}/attachments/${ATT_ID}/content`);
  });

  it("elnora_tasks_list forwards status", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_tasks_list", { status: "archived", page: 1, pageSize: 25 });
    expect(client.get).toHaveBeenCalledWith("/tasks", { page: 1, pageSize: 25, status: "archived" });
  });
});
