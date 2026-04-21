import { describe, it, expect, vi } from "vitest";
import { withGuard } from "../../src/tools/with-guard.js";
import type { RequestContext } from "../../src/server.js";
import type { ElnoraApiClient } from "../../src/services/elnora-api-client.js";

function makeContext(scopes: string[]): RequestContext {
  return {
    client: {} as ElnoraApiClient,
    clientId: "test-client",
    scopes,
  };
}

describe("withGuard", () => {
  it("allows execution when scopes are satisfied", async () => {
    const handler = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
    });
    const guarded = withGuard("elnora_tasks_list", () => makeContext(["tasks:read"]), handler);

    const result = await guarded({});
    expect(handler).toHaveBeenCalled();
    expect(result.content[0].text).toBe("ok");
    expect(result.isError).toBeUndefined();
  });

  it("blocks execution when scopes are missing", async () => {
    const handler = vi.fn();
    const guarded = withGuard("elnora_tasks_create", () => makeContext(["tasks:read"]), handler);

    const result = await guarded({});
    expect(handler).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Insufficient scope");
    expect(result.content[0].text).toContain("tasks:write");
  });

  it("blocks unknown tools (deny-by-default)", async () => {
    const handler = vi.fn();
    const guarded = withGuard("nonexistent_tool", () => makeContext(["tasks:read"]), handler);

    const result = await guarded({});
    expect(handler).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Insufficient scope");
  });

  it("allows tools with no scope requirements", async () => {
    const handler = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "healthy" }],
    });
    const guarded = withGuard("elnora_health_check", () => makeContext([]), handler);

    const result = await guarded({});
    expect(handler).toHaveBeenCalled();
    expect(result.content[0].text).toBe("healthy");
  });

  it("catches thrown errors from handler and returns isError", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("unexpected crash"));
    const guarded = withGuard("elnora_tasks_list", () => makeContext(["tasks:read"]), handler);

    const result = await guarded({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unexpected error");
    expect(result.content[0].text).toContain("unexpected crash");
  });

  it("sets isError on handler failure results", async () => {
    const handler = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "Error: something broke" }],
      isError: true,
    });
    const guarded = withGuard("elnora_tasks_list", () => makeContext(["tasks:read"]), handler);

    const result = await guarded({});
    expect(result.isError).toBe(true);
  });
});
