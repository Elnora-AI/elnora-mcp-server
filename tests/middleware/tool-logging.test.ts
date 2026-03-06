import { describe, it, expect, vi } from "vitest";
import { logToolInvocation, logAuthEvent } from "../../src/middleware/tool-logging.js";

describe("logToolInvocation", () => {
  it("logs structured JSON to stderr", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logToolInvocation("elnora_list_tasks", { page: 1 }, "test-client", { success: true, durationMs: 42 });

    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logged.type).toBe("tool_invocation");
    expect(logged.tool).toBe("elnora_list_tasks");
    expect(logged.clientId).toBe("test-client");
    expect(logged.success).toBe(true);
    expect(logged.durationMs).toBe(42);
    expect(logged.timestamp).toBeDefined();

    spy.mockRestore();
  });

  it("redacts content fields to length only", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logToolInvocation("elnora_send_message", {
      task_id: "abc-123",
      message: "hello world",
      content: "some file content",
    }, "test-client", { success: true, durationMs: 10 });

    const logged = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logged.params.message).toBe("[11 chars]");
    expect(logged.params.content).toBe("[17 chars]");
    expect(logged.params.task_id).toBe("abc-123"); // not redacted

    spy.mockRestore();
  });

  it("redacts PII fields", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logToolInvocation("elnora_invite_org_member", {
      org_id: "org-123",
      email: "user@example.com",
      first_name: "Alice",
      last_name: "Smith",
    }, "test-client", { success: true, durationMs: 5 });

    const logged = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logged.params.email).toBe("[REDACTED]");
    expect(logged.params.first_name).toBe("[REDACTED]");
    expect(logged.params.last_name).toBe("[REDACTED]");
    expect(logged.params.org_id).toBe("org-123");

    spy.mockRestore();
  });

  it("redacts array fields to count", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logToolInvocation("elnora_send_message", {
      task_id: "abc",
      file_ids: ["id1", "id2", "id3"],
      context_file_ids: ["id4"],
    }, "test-client", { success: true, durationMs: 1 });

    const logged = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logged.params.file_ids).toBe("[3 items]");
    expect(logged.params.context_file_ids).toBe("[1 items]");

    spy.mockRestore();
  });
});

describe("logAuthEvent", () => {
  it("logs structured JSON auth event to stderr", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logAuthEvent("tokens_issued", "client-abc", { expiresAt: "2026-01-01T00:00:00Z" });

    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logged.type).toBe("auth_event");
    expect(logged.event).toBe("tokens_issued");
    expect(logged.clientId).toBe("client-abc");
    expect(logged.details).toEqual({ expiresAt: "2026-01-01T00:00:00Z" });
    expect(logged.timestamp).toBeDefined();

    spy.mockRestore();
  });

  it("works without optional details", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logAuthEvent("authorize_redirect", "client-xyz");

    const logged = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logged.type).toBe("auth_event");
    expect(logged.event).toBe("authorize_redirect");
    expect(logged.clientId).toBe("client-xyz");

    spy.mockRestore();
  });
});

