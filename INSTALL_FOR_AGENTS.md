# INSTALL_FOR_AGENTS.md — Elnora MCP server setup

> **Step 0 — Identity gate.** If you are NOT an autonomous coding agent (Claude
> Code, Codex CLI, Cursor, Aider, Continue, Amp, Jules, Roo, Windsurf, etc.),
> stop reading this file and open [`README.md`](README.md) instead. This file
> walks an agent through connecting an MCP client to the **remote** Elnora MCP
> server, choosing an auth method, handling the user's API key, and running a
> smoke test against the live API. Humans should follow the README's Quick
> Start.

You are the agent handing off after the user decided to connect their MCP
client to Elnora. Unlike a CLI, there is **nothing to install** — the server
runs remotely at `https://mcp.elnora.ai/mcp`. Your job is to confirm the server
is reachable, help the user register it with their client, pick an auth method
(OAuth 2.1 or an API key), verify the tool list loads, run a smoke test, and
hand them a working connection.

Be transparent: announce each step before you run it, show the output, and
explain what you found. The user may not know what an MCP transport is or the
difference between OAuth and an API key — keep your language plain and ask one
question at a time.

**Universal:** the endpoint (`https://mcp.elnora.ai/mcp`) and the two auth
methods are identical across every client. Only the *config file or command*
that registers the server differs per client — Step 3 gives the exact form for
each. Everything else applies no matter which harness you are running under.

**Browser-assist offers:** several steps send the user to a web page (create an
API key, complete an OAuth login). If you have a browser-automation capability
available — for example the Chrome DevTools MCP — you may *offer* to drive the
navigation for them (open the dashboard, land on the API-keys page). Always ask
first, keep the user watching, and **never type the user's password or complete
their login on their behalf** — the user does that themselves. If you have no
such tool, give them the click path in words and wait.

## Step 1 — Confirm the server is reachable

Before touching any client config, prove the server answers:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' https://mcp.elnora.ai/health
curl -sS https://mcp.elnora.ai/health
```

Gates:
- The first command prints `200` (healthy) or `503` (reachable but the server's
  own Redis is degraded). **Either proves the server is reachable** — a
  connection error, DNS failure, or timeout does not.
- The second command returns a JSON body whose `service` field is
  `elnora-mcp-server`. If you get that, the endpoint is live. If the curl fails
  to connect, the problem is network/DNS/outage on the user's side or an
  Elnora incident — surface it plainly; do NOT start editing client config to
  work around an unreachable server.

Note: a plain `GET https://mcp.elnora.ai/mcp` returns **HTTP 405 Method Not
Allowed** by design — the MCP endpoint is POST-only per the Streamable HTTP
spec. A 405 there is a *healthy* server, not a fault. Don't use it as a
reachability check; use `/health` above.

## Step 2 — Pick the auth method

There are two ways to authenticate, both first-class:

- **OAuth 2.1** (the README's recommended default). On the first request the
  client opens a browser to log in to Elnora; the client then stores and
  refreshes the token automatically. Discovery lives at
  `https://mcp.elnora.ai/.well-known/oauth-authorization-server`. Best when a
  human is at an interactive client (a browser can open).
- **API key** via an `X-API-Key` header. Best for a **headless** agent, a
  server, or CI where no browser is available. The key is created in the Elnora
  dashboard and starts with `elnora_live_`.

Choose deliberately and tell the user which you picked and why:

> If you are running me somewhere a browser can pop up and you can log in,
> OAuth is the least setup. If I'm running headless — no browser — an API key
> is the reliable path. Which fits your situation?

If they choose OAuth, skip to Step 3 (the browser flow happens on the first
tool call). If they choose the API key, do Step 2a first.

### Step 2a — Collect the API key (API-key auth only)

Tell the user, verbatim:

> Open https://platform.elnora.ai, go to **Settings → API Keys**, click
> **Create new key**, copy the value, and paste it here. It starts with
> `elnora_live_`.

(If you have a browser tool, offer to open that page for them per the
browser-assist note above — but let them create and copy the key themselves.)

Gates:
- The pasted value must start with `elnora_live_`. If it doesn't, they likely
  copied the wrong field — ask again. Never guess, reconstruct, or truncate a
  key.
- Treat the key as the secret it is. It goes **only** into the client's own MCP
  config (Step 3), which lives outside any git repository. Do **not** write it
  into a repo file, a `.env` you commit, or anything the user didn't ask for.
  For Claude Code specifically, use `--scope user` (Step 3) so the key lands in
  `~/.claude.json`, never a project-tracked `.mcp.json`.

## Step 3 — Register the server with the client

Use the block for the user's client. For OAuth, use the form **without** the
`X-API-Key` header/flag; for API-key auth, include it with the key from Step 2a.

**Claude Code**

```sh
# OAuth (browser login on first use):
claude mcp add elnora --transport http --scope user https://mcp.elnora.ai/mcp

# API key:
claude mcp add elnora --transport http --scope user \
  https://mcp.elnora.ai/mcp --header "X-API-Key: <paste-key>"
```

Verify: `claude mcp list` shows an `elnora` entry with no connection error.
Keep `--scope user` (config in `~/.claude.json`, available in every project)
unless the user explicitly wants a single-project or team-shared scope — and if
they pick project scope with an API key, warn that `.mcp.json` is committed to
the repo, so the key must NOT go there.

**Cursor** — Settings → MCP Servers, add:

```json
{
  "mcpServers": {
    "elnora": {
      "url": "https://mcp.elnora.ai/mcp",
      "headers": { "X-API-Key": "<paste-key>" }
    }
  }
}
```

**VS Code (Copilot)** — `.vscode/mcp.json`:

```json
{
  "servers": {
    "elnora": {
      "type": "http",
      "url": "https://mcp.elnora.ai/mcp",
      "headers": { "X-API-Key": "<paste-key>" }
    }
  }
}
```

**Codex** — an `mcp.json` passed via `codex --mcp-config mcp.json`:

```json
{
  "mcpServers": {
    "elnora": {
      "url": "https://mcp.elnora.ai/mcp",
      "headers": { "X-API-Key": "<paste-key>" }
    }
  }
}
```

**ChatGPT** — add a remote MCP server in ChatGPT settings using the URL
`https://mcp.elnora.ai/mcp`. The ChatGPT connector completes auth via the OAuth
browser flow; there is no header field, so the API-key path does not apply
there.

For **OAuth**, drop the `headers` block (or the `--header` flag) entirely and
leave just the `url`. On the first tool call the client opens a browser; the
user logs into Elnora and approves, and the client stores the token. If you are
headless and no browser opens, that is the signal OAuth won't work in this
environment — fall back to the API-key path (Step 2 → 2a → this step with the
header).

If the user's config file is tracked by git and now contains a key, remind them
to keep it out of version control (add it to `.gitignore`, or move to a
user-scoped location).

## Step 4 — Verify the tool list loads

Have the client list the server's tools. In Claude Code, run the `/mcp` command
(or reconnect); other clients surface an MCP tool list in their UI.

Gates:
- The list is **non-empty** and every tool name is prefixed `elnora_` in the
  shape `elnora_{group}_{action}` — e.g. `elnora_health_check`,
  `elnora_projects_list`, `elnora_files_upload`. The groups span protocols,
  tasks, files, projects, organizations, folders, library, search, API keys,
  audit, account, feedback, feature flags, and health (see the README's
  capability table).
- If the list is **empty** or the client reports **401 Unauthorized**, auth did
  not take. For API-key auth, re-check the header value and that the key starts
  with `elnora_live_`. For OAuth, re-run the login. Don't proceed to Step 5
  until tools appear.

## Step 5 — Smoke test

Confirm the full path (client → MCP server → Elnora platform) end to end. Start
with the lowest-privilege tool:

> Ask your client, verbatim: **"Call the elnora_health_check tool."**

`elnora_health_check` is read-only and the safest first call. Gate: it returns
a JSON health payload, not an error.

Then confirm an authenticated read works:

> Ask your client: **"List my Elnora projects."**

The client should call `elnora_projects_list` and return your projects — or an
**empty list** if you have none. An empty list is a *pass* (you may simply have
no projects yet); distinguish it from an error.

Failure modes:
- **401 Unauthorized** — the token or key wasn't accepted. OAuth: re-run the
  login. API key: regenerate it in the dashboard and redo Step 3. Never retry
  with a key you guessed or pieced together.
- **403 Forbidden** — the key/account is valid but lacks access to that
  specific resource. Note it and continue; flag it in the Step 6 summary.
- **408 / timeout** — only expected for heavy calls like protocol generation
  (which can take up to ~120s). `elnora_health_check` and list calls should
  return quickly; a timeout on those points at a network problem, not a slow
  operation.

## Step 6 — Handoff summary

Tell the user, in this order:

1. **What's connected and where the config lives** — the client and its config
   location (`~/.claude.json` for Claude Code user scope, `.vscode/mcp.json`,
   the Cursor MCP settings, the Codex `mcp.json`, etc.).
2. **Which auth method is active** — OAuth (token stored and auto-refreshed by
   the client) or API key. If it's an API key: it lives in the client config
   only, must never be committed to version control, and rotates from the
   Elnora dashboard.
3. **How to use it** — three example prompts from the README:
   - "Use Elnora to generate a HEK 293 cell maintenance protocol."
   - "List my files in Elnora, then show me the most recent protocol."
   - "Show me my active Elnora tasks and get the messages from the latest one."
   Tools are discoverable any time through the client's tool listing (`/mcp` in
   Claude Code).
4. **Any warnings from Step 5** — e.g. a 403 that means the key is scoped to a
   subset of resources, so the user isn't surprised later.

## Completion checklist

Before declaring the setup complete, verify ALL of these. If any item fails,
finish it before reporting done.

1. `curl -sS -o /dev/null -w '%{http_code}\n' https://mcp.elnora.ai/health`
   prints `200` (or `503`), proving the server is reachable.
2. The client lists the server with no connection error (`claude mcp list`
   shows `elnora`, or the client's equivalent).
3. The client shows a **non-empty** set of `elnora_*` tools.
4. A call to `elnora_health_check` returns a health payload (not an error), and
   a call to `elnora_projects_list` returns projects or a clean empty list.
5. If API-key auth: the key is stored **only** in the client's own MCP config
   (user-scoped / outside any git repo), starts with `elnora_live_`, and is not
   written into any committed file.
6. You have NOT written the API key — or anything else the user didn't ask for
   — into a repository file.

When all applicable items pass, print `ELNORA_MCP_READY` on its own line so the
user (and any wrapping harness) can grep for it.
