import { describe, it, expect, vi } from "vitest";
import { createElnoraServer, RequestContext } from "../../src/server.js";
import { ALL_SCOPES } from "../../src/constants.js";
import type { ElnoraApiClient } from "../../src/services/elnora-api-client.js";

// Regression guard for the route corrections: several tools previously called
// non-existent backend routes (404) or the wrong HTTP verb (405). These tests
// invoke each fixed tool's handler with a spy client and assert the exact
// path/method it calls, so the drift can't silently return.

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

const ORG_ID = "d1ff6d88-f3e6-465e-b1d6-89cd840b1dc5";
const VERSION_ID = "abc-123";

describe("route corrections (regression for 404/405 tool bugs)", () => {
  it("elnora_orgs_setDefault → PUT /organizations/{id}/set-default", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_orgs_setDefault", { orgId: ORG_ID });
    expect(client.put).toHaveBeenCalledWith(`/organizations/${ORG_ID}/set-default`);
  });

  it("elnora_orgs_listAll → GET /organizations/all", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_orgs_listAll", {});
    expect(client.get).toHaveBeenCalledWith("/organizations/all");
  });

  it("elnora_account_delete → DELETE /account/me", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_account_delete", { yes: true });
    expect(client.del).toHaveBeenCalledWith("/account/me");
  });

  it("elnora_account_users → GET /account/user/list", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_account_users", {});
    expect((client.get as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]).toBe("/account/user/list");
  });

  it("elnora_account_addLegalDoc → POST /userAgreement/legalDocumentVersion", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_account_addLegalDoc", { documentType: "tos", version: "1", content: "x" });
    expect((client.post as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]).toBe("/userAgreement/legalDocumentVersion");
  });

  it("elnora_account_updateLegalDoc → PUT /userAgreement/legalDocumentVersion/{id} (not PATCH)", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_account_updateLegalDoc", { versionId: VERSION_ID, content: "x" });
    expect((client.put as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]).toBe(`/userAgreement/legalDocumentVersion/${VERSION_ID}`);
    expect(client.patch).not.toHaveBeenCalled();
  });

  it("elnora_account_deleteLegalDoc → DELETE /userAgreement/legalDocumentVersion/{id}", async () => {
    const { client, invoke } = makeServerWithSpyClient();
    await invoke("elnora_account_deleteLegalDoc", { versionId: VERSION_ID, yes: true });
    expect(client.del).toHaveBeenCalledWith(`/userAgreement/legalDocumentVersion/${VERSION_ID}`);
  });
});
