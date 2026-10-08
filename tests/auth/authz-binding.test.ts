import { describe, it, expect } from "vitest";
import {
  authzBindingCookieName,
  newBindingValue,
  bindingCookieOptions,
  readSingleCookie,
  safeBindingEqual,
} from "../../src/auth/authz-binding.js";

describe("authz-binding", () => {
  describe("authzBindingCookieName", () => {
    it("uses the __Host- prefix on https (production)", () => {
      expect(authzBindingCookieName("https://mcp.elnora.ai")).toBe("__Host-mcp_authz_binding");
    });
    it("falls back to the bare name on http localhost (dev)", () => {
      expect(authzBindingCookieName("http://localhost:3000")).toBe("mcp_authz_binding");
    });
  });

  describe("bindingCookieOptions", () => {
    it("is Secure, HttpOnly, SameSite=Lax, Path=/ on https, with no maxAge (session cookie)", () => {
      const o = bindingCookieOptions("https://mcp.elnora.ai");
      expect(o).toEqual({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
      expect("maxAge" in o).toBe(false);
    });
    it("is not Secure on http (dev)", () => {
      expect(bindingCookieOptions("http://localhost:3000").secure).toBe(false);
    });
  });

  describe("newBindingValue", () => {
    it("returns a 43-char base64url value (32 bytes) and is unique per call", () => {
      const a = newBindingValue();
      const b = newBindingValue();
      expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(a).not.toBe(b);
    });
  });

  describe("readSingleCookie", () => {
    it("returns undefined when the header is absent", () => {
      expect(readSingleCookie(undefined, "x")).toBeUndefined();
    });
    it("returns undefined when the name is not present", () => {
      expect(readSingleCookie("a=1; b=2", "x")).toBeUndefined();
    });
    it("returns the value for a single match (tolerating whitespace)", () => {
      expect(readSingleCookie("a=1;  x=hello ; b=2", "x")).toBe("hello");
    });
    it("returns null when the name appears more than once (ambiguous/tampering)", () => {
      expect(readSingleCookie("x=one; x=two", "x")).toBeNull();
    });
    it("matches the exact name only (no prefix collisions)", () => {
      expect(readSingleCookie("xy=1; x=2", "x")).toBe("2");
    });
  });

  describe("safeBindingEqual", () => {
    it("is true for equal values", () => {
      const v = newBindingValue();
      expect(safeBindingEqual(v, v)).toBe(true);
    });
    it("is false for different values of equal length", () => {
      expect(safeBindingEqual("a".repeat(43), "b".repeat(43))).toBe(false);
    });
    it("is false (never throws) for different lengths", () => {
      expect(safeBindingEqual("short", "a".repeat(43))).toBe(false);
    });
    it("is false when either side is missing", () => {
      expect(safeBindingEqual(undefined, "x")).toBe(false);
      expect(safeBindingEqual(null, "x")).toBe(false);
      expect(safeBindingEqual("x", undefined)).toBe(false);
    });
  });
});
