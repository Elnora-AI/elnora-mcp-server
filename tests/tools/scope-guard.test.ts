import { describe, it, expect } from "vitest";
import { checkToolScopes, TOOL_SCOPES } from "../../src/tools/scope-guard.js";

describe("checkToolScopes", () => {
  it("returns empty array when all scopes are granted", () => {
    const missing = checkToolScopes("elnora_tasks_list", ["tasks:read"]);
    expect(missing).toEqual([]);
  });

  it("returns missing scopes when not all are granted", () => {
    const missing = checkToolScopes("elnora_tasks_create", ["tasks:read"]);
    expect(missing).toEqual(["tasks:write"]);
  });

  it("returns empty array for tools requiring no scopes (e.g. health check)", () => {
    const missing = checkToolScopes("elnora_health_check", []);
    expect(missing).toEqual([]);
  });

  it("denies unknown tools (deny-by-default)", () => {
    const missing = checkToolScopes("nonexistent_tool", ["tasks:read"]);
    expect(missing).toContain("tool_not_registered:nonexistent_tool");
    expect(missing.length).toBeGreaterThan(0);
  });

  it("handles multi-scope requirements (elnora_protocols_generate)", () => {
    // Requires both tasks:write and messages:write
    const missing = checkToolScopes("elnora_protocols_generate", ["tasks:write"]);
    expect(missing).toEqual(["messages:write"]);

    const noneMissing = checkToolScopes("elnora_protocols_generate", ["tasks:write", "messages:write"]);
    expect(noneMissing).toEqual([]);
  });

  it("has entries for at least 80 tools", () => {
    const toolCount = Object.keys(TOOL_SCOPES).length;
    expect(toolCount).toBeGreaterThanOrEqual(80);
  });
});
