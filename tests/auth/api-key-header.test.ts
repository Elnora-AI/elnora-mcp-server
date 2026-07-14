import { describe, it, expect } from "vitest";
import { resolveApiKeyFromHeaders, API_KEY_TOKEN_PREFIX } from "../../src/auth/api-key-header.js";

const KEY = `${API_KEY_TOKEN_PREFIX}aaaabbbbccccddddeeeeffffgggghhhh`;
// A real OAuth access token: crypto.randomBytes(32).toString("base64url") — never has the key prefix.
const OAUTH_TOKEN = "Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZmdoaWprbG0";

describe("resolveApiKeyFromHeaders", () => {
  it("returns the key from the X-API-Key header", () => {
    expect(resolveApiKeyFromHeaders(KEY, undefined)).toBe(KEY);
  });

  it("returns an API key presented as a bearer token", () => {
    expect(resolveApiKeyFromHeaders(undefined, `Bearer ${KEY}`)).toBe(KEY);
  });

  it("accepts a lowercase bearer scheme", () => {
    expect(resolveApiKeyFromHeaders(undefined, `bearer ${KEY}`)).toBe(KEY);
  });

  it("ignores a bearer token that is NOT an Elnora key (real OAuth token → OAuth path)", () => {
    expect(resolveApiKeyFromHeaders(undefined, `Bearer ${OAUTH_TOKEN}`)).toBeUndefined();
  });

  it("returns undefined when no credential header is present", () => {
    expect(resolveApiKeyFromHeaders(undefined, undefined)).toBeUndefined();
  });

  it("prefers X-API-Key over Authorization", () => {
    const other = `${API_KEY_TOKEN_PREFIX}otherotherotherotherotherother00`;
    expect(resolveApiKeyFromHeaders(KEY, `Bearer ${other}`)).toBe(KEY);
  });

  it("handles array-valued headers (takes the first)", () => {
    expect(resolveApiKeyFromHeaders([KEY, "ignored"], undefined)).toBe(KEY);
  });

  it("ignores an Authorization header that is not a bearer scheme", () => {
    expect(resolveApiKeyFromHeaders(undefined, `Basic ${KEY}`)).toBeUndefined();
  });
});
