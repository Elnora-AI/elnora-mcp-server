/**
 * End-to-end smoke test that exercises the full tool-registration pipeline
 * the way a real MCP connection would: it builds the server, enumerates every
 * registered tool, and cross-references against the scope-guard map.
 *
 * If this passes, the tool surface is consistent:
 *   - Every tool registered via registerXxxTools has a scope entry
 *   - Every scope entry has a real tool registered
 *   - Every tool name matches the elnora_{group}_{action} convention
 */
import { describe, it, expect } from "vitest";
import { createElnoraServer } from "../src/server.js";
import { ElnoraApiClient } from "../src/services/elnora-api-client.js";
import { TOOL_SCOPES } from "../src/tools/scope-guard.js";
import { ALL_SCOPES } from "../src/constants.js";
import type { ElnoraConfig } from "../src/types.js";

const config: ElnoraConfig = {
  apiUrl: "https://platform.elnora.ai/api/v1",
  tokenValidationUrl: "https://platform.elnora.ai/api/v1/auth/validate-token",
  port: 3000,
  publicUrl: "https://mcp.elnora.ai",
  loginUrl: "https://platform.elnora.ai/login",
  tokenExchangeUrl: "https://platform.elnora.ai/api/v1/auth/token",
  platformClientId: "smoke",
  platformClientSecret: "smoke",
  mcpServiceKey: "smoke",
};

describe("Smoke test — tool surface consistency", () => {
  const getContext = () => ({
    client: new ElnoraApiClient(config, "smoke-token"),
    clientId: "smoke",
    scopes: ALL_SCOPES,
  });

  const server = createElnoraServer(getContext);
  const registeredTools = Object.keys(
    (server as unknown as Record<string, Record<string, unknown>>)._registeredTools,
  ).sort();
  const scopedTools = Object.keys(TOOL_SCOPES).sort();

  it("registers at least 85 tools", () => {
    expect(registeredTools.length).toBeGreaterThanOrEqual(85);
  });

  it("every registered tool has a scope entry", () => {
    const missingScopes = registeredTools.filter((t) => !(t in TOOL_SCOPES));
    expect(missingScopes).toEqual([]);
  });

  it("every scope entry has a registered tool (no orphan scopes)", () => {
    const orphanScopes = scopedTools.filter((t) => !registeredTools.includes(t));
    expect(orphanScopes).toEqual([]);
  });

  it("all tool names use elnora_{group}_{action} convention", () => {
    const malformed = registeredTools.filter(
      (t) => !/^elnora_[a-z0-9-]+_[a-zA-Z0-9]+$/.test(t),
    );
    expect(malformed).toEqual([]);
  });

  it("registered tool count matches scope map count", () => {
    expect(registeredTools.length).toBe(scopedTools.length);
  });
});
