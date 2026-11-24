import { describe, it, expect } from "vitest";
import { createElnoraServer, type ServerOptions } from "../../src/server.js";
import { ElnoraApiClient } from "../../src/services/elnora-api-client.js";
import { SIGN_IN_UNAVAILABLE_TOOLS, TOOL_SCOPES } from "../../src/tools/scope-guard.js";
import { ALL_SCOPES } from "../../src/constants.js";
import type { ElnoraConfig } from "../../src/types.js";

const config: ElnoraConfig = {
  apiUrl: "https://platform.elnora.ai/api/v1",
  tokenValidationUrl: "https://platform.elnora.ai/api/v1/auth/validate-token",
  port: 3000,
  publicUrl: "https://mcp.elnora.ai",
  loginUrl: "https://platform.elnora.ai/login",
  tokenExchangeUrl: "https://platform.elnora.ai/api/v1/auth/token",
  platformClientId: "test",
  platformClientSecret: "test",
  mcpServiceKey: "test",
};

const getContext = () => ({
  client: new ElnoraApiClient(config, "test-token"),
  clientId: "test",
  scopes: ALL_SCOPES,
});

function registeredTools(options?: ServerOptions): string[] {
  const server = createElnoraServer(getContext, options);
  return Object.keys((server as unknown as Record<string, Record<string, unknown>>)._registeredTools).sort();
}

const allTools = Object.keys(TOOL_SCOPES).sort();

describe("Tool list for a sign-in session", () => {
  it("names only tools that exist", () => {
    expect([...SIGN_IN_UNAVAILABLE_TOOLS].filter((t) => !(t in TOOL_SCOPES))).toEqual([]);
  });

  it("a sign-in session does not list the tools it cannot use, and lists every other tool", () => {
    expect(registeredTools({ signIn: true })).toEqual(allTools.filter((t) => !SIGN_IN_UNAVAILABLE_TOOLS.has(t)));
  });

  it("an API-key session lists every tool", () => {
    expect(registeredTools({ signIn: false })).toEqual(allTools);
    expect(registeredTools()).toEqual(allTools);
  });
});
