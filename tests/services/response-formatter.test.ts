import { describe, it, expect } from "vitest";
import { formatToolResult } from "../../src/services/response-formatter.js";

describe("formatToolResult", () => {
  it("returns the input unchanged when no options are set", () => {
    expect(formatToolResult("[]", {})).toBe("[]");
    expect(formatToolResult('{"a":1}', {})).toBe('{"a":1}');
  });

  it("returns non-JSON input unchanged", () => {
    expect(formatToolResult("raw file content", { compact: true })).toBe("raw file content");
  });

  // Regression: compact on an EMPTY result must stay a valid JSON string.
  // stripEmpty([]) → undefined and JSON.stringify(undefined) → undefined, which
  // previously produced `text: undefined` and crashed the tool call with -32602.
  it("keeps an empty array as '[]' under compact (not undefined)", () => {
    const out = formatToolResult("[]", { compact: true });
    expect(out).toBe("[]");
    expect(typeof out).toBe("string");
  });

  it("keeps an empty object as '{}' under compact", () => {
    const out = formatToolResult("{}", { compact: true });
    expect(out).toBe("{}");
    expect(typeof out).toBe("string");
  });

  it("always returns a string even when compaction strips everything", () => {
    // An object whose only values are empty collapses to undefined via stripEmpty.
    const out = formatToolResult('{"items":[],"note":""}', { compact: true });
    expect(typeof out).toBe("string");
    expect(() => JSON.parse(out)).not.toThrow();
  });

  it("compacts a non-empty result (strips null/empty fields)", () => {
    const out = formatToolResult('{"id":"x","note":null,"tags":[]}', { compact: true });
    expect(JSON.parse(out)).toEqual({ id: "x" });
  });

  it("applies fields filtering", () => {
    const out = formatToolResult('[{"id":"1","name":"a","extra":9}]', { fields: "id,name" });
    expect(JSON.parse(out)).toEqual([{ id: "1", name: "a" }]);
  });
});
