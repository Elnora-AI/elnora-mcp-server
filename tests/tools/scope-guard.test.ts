import { describe, it, expect } from "vitest";
import { checkToolScopes, TOOL_SCOPES } from "../../src/tools/scope-guard.js";

describe("checkToolScopes", () => {
  it("returns empty array when all scopes are granted", () => {
    const missing = checkToolScopes("elnora_list_tasks", ["tasks:read"]);
    expect(missing).toEqual([]);
  });

  it("returns missing scopes when not all are granted", () => {
    const missing = checkToolScopes("elnora_create_task", ["tasks:read"]);
    expect(missing).toEqual(["tasks:write"]);
  });

  it("returns empty array for tools requiring no scopes (e.g. health check)", () => {
    const missing = checkToolScopes("elnora_health_check", []);
    expect(missing).toEqual([]);
  });

  it("denies unknown tools (deny-by-default)", () => {
    const missing = checkToolScopes("nonexistent_tool", ["tasks:read"]);
    expect(missing).toContain("unknown_tool");
    expect(missing.length).toBeGreaterThan(0);
  });

  it("handles multi-scope requirements (elnora_generate_protocol)", () => {
    // Requires both tasks:write and messages:write
    const missing = checkToolScopes("elnora_generate_protocol", ["tasks:write"]);
    expect(missing).toEqual(["messages:write"]);

    const noneMissing = checkToolScopes("elnora_generate_protocol", ["tasks:write", "messages:write"]);
    expect(noneMissing).toEqual([]);
  });

  it("has entries for at least 74 tools", () => {
    const toolCount = Object.keys(TOOL_SCOPES).length;
    expect(toolCount).toBeGreaterThanOrEqual(74);
  });
});
