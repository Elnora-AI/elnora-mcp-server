import { describe, it, expect, vi } from "vitest";
import { createElnoraServer, RequestContext } from "../../src/server.js";
import { ALL_SCOPES } from "../../src/constants.js";
import type { ElnoraApiClient } from "../../src/services/elnora-api-client.js";

// ELN-880/881 removed the platform "project" concept. The elnora_projects_* tools
// and the legacy elnora_folders_list stay registered (CLI↔MCP parity + back-compat)
// but are deprecated no-ops: they must NOT call the retired /projects compat shim.

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
  const tools = (
    server as unknown as {
      _registeredTools: Record<string, { handler: (args: unknown, extra: unknown) => Promise<unknown> }>;
    }
  )._registeredTools;
  const invoke = (name: string, args: Record<string, unknown>) => tools[name].handler(args, {});
  return { client, invoke };
}

const PROJECT_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const USER_ID = "d5c4b3a2-f6e5-4b7a-9d8c-1f0e2a3b4c5d";

const DEPRECATED_TOOL_CALLS: Array<[string, Record<string, unknown>]> = [
  ["elnora_projects_list", {}],
  ["elnora_projects_get", { projectId: PROJECT_ID }],
  ["elnora_projects_create", { name: "X" }],
  ["elnora_projects_update", { projectId: PROJECT_ID, name: "Y" }],
  ["elnora_projects_archive", { projectId: PROJECT_ID }],
  ["elnora_projects_members", { projectId: PROJECT_ID }],
  ["elnora_projects_addMember", { projectId: PROJECT_ID, userId: USER_ID }],
  ["elnora_projects_updateRole", { projectId: PROJECT_ID, userId: USER_ID, role: "Admin" }],
  ["elnora_projects_removeMember", { projectId: PROJECT_ID, userId: USER_ID }],
  ["elnora_projects_leave", { projectId: PROJECT_ID }],
  ["elnora_folders_list", { projectId: PROJECT_ID }],
];

describe("deprecated project tools are no-ops", () => {
  for (const [name, args] of DEPRECATED_TOOL_CALLS) {
    it(`${name} returns a deprecation notice without calling the backend`, async () => {
      const { client, invoke } = makeServerWithSpyClient();
      const result = await invoke(name, args);
      expect(client.get).not.toHaveBeenCalled();
      expect(client.post).not.toHaveBeenCalled();
      expect(client.put).not.toHaveBeenCalled();
      expect(client.patch).not.toHaveBeenCalled();
      expect(client.del).not.toHaveBeenCalled();
      expect(JSON.stringify(result)).toContain("deprecated");
    });
  }
});
