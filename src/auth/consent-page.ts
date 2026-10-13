import { SCOPE_DESCRIPTIONS, SENSITIVE_SCOPES } from "../constants.js";

/**
 * Server-rendered consent screen for the OAuth authorization flow.
 *
 * The MCP server is an OAuth proxy in front of the Elnora platform: it holds a single static client
 * registration with the platform, while individual applications register with the MCP server via
 * Dynamic Client Registration (RFC 7591). The platform therefore never sees the real downstream
 * application, so consent cannot be delegated upstream — it MUST be obtained here, by this server,
 * for each dynamically registered client before the browser is forwarded to the platform login
 * (OAuth 2.1 / MCP authorization). Showing the user which application is asking and, above all, where
 * the authorization code would be delivered (the redirect host) is what makes it safe to honour a
 * non-loopback client at all.
 *
 * Security notes for anyone editing this file:
 * - `clientName` is supplied by the application at registration time and is NOT trusted. It is
 *   escaped and length-capped, shown as unverified, and never used for any decision.
 * - The redirect host is the security anchor. It is derived from the registered redirect URI with the
 *   same URL parser used to deliver the code, and displayed as the most prominent element.
 * - Every interpolated value passes through escapeHtml. The page contains no JavaScript so a strict
 *   CSP (no script-src) can be applied by the caller.
 */

/**
 * Content-Security-Policy for consent-flow HTML responses. No script-src at all (the page has no
 * JavaScript), styles are inline only, framing is denied, and — importantly — `form-action` is NOT
 * constrained: Chromium enforces form-action across the post-submit redirect chain, and both the
 * Allow (→ platform login) and Deny (→ client redirect) targets are cross-origin, so pinning it would
 * break the flow. X-Frame-Options: DENY (global) plus frame-ancestors here cover clickjacking.
 */
export const CONSENT_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; frame-ancestors 'none'";

/** Escape the five HTML-significant characters so interpolated values cannot break out of markup. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strip control characters and cap length — applied to untrusted display strings before escaping. */
function sanitizeDisplay(value: string, maxLength = 120): string {
  const cleaned = value.replace(/[\x00-\x1f\x7f]/g, "").trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}…` : cleaned;
}

/** Derive the redirect host exactly as the code-delivery path does; returns ASCII (punycode) form. */
function redirectHost(redirectUri: string): string {
  try {
    return new URL(redirectUri).host;
  } catch {
    return "";
  }
}

const PAGE_STYLE = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px; font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #f4f5f7; color: #1a1a1a; }
  .card { background: #fff; width: 100%; max-width: 460px; border-radius: 12px; padding: 28px;
    box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.08); }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #5a6270; margin: 0 0 20px; font-size: 14px; }
  .host { font-size: 22px; font-weight: 700; word-break: break-all; margin: 2px 0 2px; }
  .host-label { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #5a6270; margin: 0; }
  .target { background: #f0f7ff; border: 1px solid #cfe3fb; border-radius: 8px; padding: 14px 16px; margin: 0 0 18px; }
  .target .uri { font-size: 12px; color: #5a6270; word-break: break-all; margin: 6px 0 0; }
  .app { font-size: 14px; margin: 0 0 18px; }
  .app .name { font-weight: 600; }
  .app .unverified { color: #8a6d00; font-size: 12px; }
  ul.scopes { list-style: none; padding: 0; margin: 0 0 18px; border-top: 1px solid #eceef1; }
  ul.scopes li { padding: 10px 0; border-bottom: 1px solid #eceef1; }
  ul.scopes .desc { display: block; }
  ul.scopes .scope { color: #8a909b; font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .tag-write { display: inline-block; margin-left: 6px; font-size: 11px; font-weight: 600; color: #8a1500;
    background: #ffe9e3; border-radius: 4px; padding: 1px 6px; vertical-align: middle; }
  .warn { background: #fff6e6; border: 1px solid #f3dca0; border-radius: 8px; padding: 12px 14px; margin: 0 0 18px;
    font-size: 13px; color: #6b4e00; }
  .actions { display: flex; flex-direction: column; gap: 10px; }
  button { font: inherit; font-weight: 600; border-radius: 8px; padding: 12px 16px; cursor: pointer; width: 100%; }
  button.deny { background: #1a1a1a; color: #fff; border: 1px solid #1a1a1a; }
  button.allow { background: #fff; color: #1a1a1a; border: 1px solid #c4c9d1; }
  .foot { color: #8a909b; font-size: 12px; margin: 16px 0 0; text-align: center; }
  @media (prefers-color-scheme: dark) {
    body { background: #16181d; color: #e8eaed; }
    .card { background: #1f2229; box-shadow: none; }
    .sub, .host-label, .target .uri, .foot { color: #9aa0ab; }
    .target { background: #16202c; border-color: #27384d; }
    ul.scopes, ul.scopes li { border-color: #2a2e36; }
    button.deny { background: #e8eaed; color: #16181d; border-color: #e8eaed; }
    button.allow { background: #1f2229; color: #e8eaed; border-color: #3a3f49; }
    .warn { background: #2b2410; border-color: #4a3d12; color: #e4c877; }
    .app .unverified { color: #e4c877; }
  }
`;

export interface ConsentPageParams {
  /** Application-supplied client name (UNTRUSTED). */
  clientName?: string;
  /** The registered redirect URI the code would be delivered to. */
  redirectUri: string;
  /** Scopes that would be granted (already filtered to what the client may receive). */
  scopes: string[];
  /** Opaque session handle echoed back on submit to identify this authorization. */
  mcpCode: string;
}

/**
 * Render the consent page as a complete HTML document. Pure (no I/O, no throw for normal input), so
 * the caller can build the string first and only then write response headers + body.
 */
export function renderConsentPage(params: ConsentPageParams): string {
  const { clientName, redirectUri, scopes, mcpCode } = params;
  const host = escapeHtml(redirectHost(redirectUri));
  const uri = escapeHtml(sanitizeDisplay(redirectUri, 200));
  const name = clientName ? escapeHtml(sanitizeDisplay(clientName)) : "";
  const hasSensitive = scopes.some((s) => SENSITIVE_SCOPES.has(s));

  const scopeItems = scopes
    .map((scope) => {
      const desc = escapeHtml(SCOPE_DESCRIPTIONS[scope] ?? scope);
      const writeTag = SENSITIVE_SCOPES.has(scope) ? `<span class="tag-write">Write access</span>` : "";
      return `<li><span class="desc">${desc}${writeTag}</span><span class="scope">${escapeHtml(scope)}</span></li>`;
    })
    .join("");

  const appLine = name
    ? `<p class="app">Requested by <span class="name">${name}</span> <span class="unverified">(name reported by the application — not verified)</span></p>`
    : `<p class="app">Requested by an application that did not provide a verified name.</p>`;

  const warnBlock = hasSensitive
    ? `<div class="warn"><strong>This application is requesting permission to make changes to your account.</strong> Only continue if you recognise it and started this connection yourself.</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Authorize access to Elnora</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<main class="card">
  <h1>Authorize access to your Elnora account</h1>
  <p class="sub">An application is asking to connect to your Elnora account. If you approve, after you sign in, an authorization code will be sent to:</p>
  <div class="target">
    <p class="host-label">Authorization code will be sent to</p>
    <p class="host">${host}</p>
    <p class="uri">${uri}</p>
  </div>
  ${appLine}
  ${warnBlock}
  <ul class="scopes">${scopeItems}</ul>
  <form method="POST" action="/oauth/consent">
    <input type="hidden" name="mcp_code" value="${escapeHtml(mcpCode)}">
    <div class="actions">
      <button type="submit" name="decision" value="deny" class="deny">Cancel — don't connect</button>
      <button type="submit" name="decision" value="allow" class="allow">Continue to sign in &amp; allow</button>
    </div>
  </form>
  <p class="foot">If you didn't start this, cancel. No access is granted unless you continue.</p>
</main>
</body>
</html>`;
}

/** Render a short, safe HTML error page for consent-flow failures (expired/invalid/unverifiable). */
export function renderConsentErrorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Authorization could not be completed</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<main class="card">
  <h1>Authorization could not be completed</h1>
  <p class="sub">${escapeHtml(message)}</p>
  <p class="foot">You can safely close this window and start the connection again.</p>
</main>
</body>
</html>`;
}
