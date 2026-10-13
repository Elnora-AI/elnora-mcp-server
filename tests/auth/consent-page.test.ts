import { describe, it, expect } from "vitest";
import { escapeHtml, renderConsentPage, renderConsentErrorPage } from "../../src/auth/consent-page.js";

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("leaves safe text unchanged", () => {
    expect(escapeHtml("Claude Desktop 1.2")).toBe("Claude Desktop 1.2");
  });
});

describe("renderConsentPage", () => {
  const base = {
    clientName: "Claude",
    redirectUri: "https://claude.ai/api/mcp/auth_callback",
    scopes: ["tasks:read", "files:read"],
    mcpCode: "abc123",
  };

  it("shows the redirect host derived with the same parser used for delivery", () => {
    const html = renderConsentPage(base);
    expect(html).toContain(new URL(base.redirectUri).host); // claude.ai
    expect(html).toContain("claude.ai");
  });

  it("includes the full redirect URI and the opaque mcp_code as a hidden field", () => {
    const html = renderConsentPage(base);
    expect(html).toContain(`name="mcp_code" value="abc123"`);
    expect(html).toContain("https://claude.ai/api/mcp/auth_callback");
  });

  it("posts the decision to /oauth/consent with allow and deny buttons", () => {
    const html = renderConsentPage(base);
    expect(html).toContain(`method="POST" action="/oauth/consent"`);
    expect(html).toContain(`name="decision" value="allow"`);
    expect(html).toContain(`name="decision" value="deny"`);
  });

  it("escapes an attacker-supplied client name (no raw script survives)", () => {
    const html = renderConsentPage({ ...base, clientName: `<script>alert(1)</script>` });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes an attacker-supplied redirect URI so it cannot break out of markup", () => {
    const html = renderConsentPage({
      ...base,
      // The SDK guarantees a registered URI, but render defensively regardless.
      redirectUri: `https://evil.example.com/"><img src=x>`,
    });
    expect(html).not.toContain(`"><img src=x>`);
  });

  it("renders human-readable scope descriptions", () => {
    const html = renderConsentPage(base);
    expect(html).toContain("View your tasks and their messages");
    expect(html).toContain("View and download your files");
  });

  it("flags write scopes and shows a change-permission warning", () => {
    const html = renderConsentPage({ ...base, scopes: ["tasks:read", "tasks:write"] });
    expect(html).toContain("Write access");
    expect(html).toContain("requesting permission to make changes");
  });

  it("shows no change-permission warning for a read-only request", () => {
    const html = renderConsentPage(base);
    expect(html).not.toContain("Write access");
    expect(html).not.toContain("requesting permission to make changes");
  });

  it("falls back to a generic label when the client provided no name", () => {
    const html = renderConsentPage({ ...base, clientName: undefined });
    expect(html).toContain("did not provide a verified name");
  });

  it("contains no <script> tags (CSP-compatible, no inline JS)", () => {
    const html = renderConsentPage(base);
    expect(html).not.toContain("<script");
  });
});

describe("renderConsentErrorPage", () => {
  it("renders and escapes the message", () => {
    const html = renderConsentErrorPage(`expired <x>`);
    expect(html).toContain("expired &lt;x&gt;");
    expect(html).not.toContain("<x>");
  });
});
