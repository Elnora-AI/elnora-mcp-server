# Local E2E verification

This recipe validates the MCP server against a real backend end-to-end.
Run it before cutting a release when the tool surface has changed.

## 1. Start the platform locally

In a separate checkout of `elnora-platform-elnora-2.0`:

```bash
npm run docker:dev:build
```

Wait for `docker ps` to show these containers healthy:
- frontend (:3000)
- backend (:5265)
- ai-server (:8000)
- postgres (:5432)
- redis (:6379)

## 2. Mint a test API key

- Open http://localhost:3000
- Sign up a test user, create an org
- Settings → API Keys → Create new key (starts with `elnora_live_`)

## 3. Start the MCP server

In `elnora-mcp-server`:

```bash
docker compose up -d    # starts redis for the MCP server's own token store
cp .env.example .env
# edit .env so ELNORA_API_URL points at http://host.docker.internal:5265/api/v1
npm install
npm run dev
```

Wait for `listening on :3000` (or the port from `.env`).

## 4. Smoke-test via MCP Inspector

```bash
npx @modelcontextprotocol/inspector http://localhost:3000/mcp
```

In the Inspector UI:
1. Connect with `X-API-Key: <your-key>` header.
2. Click **List Tools**. The count must equal the CLI registry count (as
   of this writing, 90 tools). Every name is `elnora_{group}_{action}`.
3. Call five representative tools and verify successful JSON responses:
   - `elnora_health_check` — public, no auth.
   - `elnora_account_get` — read, needs `account:read`.
   - `elnora_projects_list` — read, paginated.
   - `elnora_projects_create` — write.
   - `elnora_files_promote` — write (newly added in v1.0).

## 5. Run the live audit

In `elnora-cli`:

```bash
pnpm exec tsx scripts/audit-mcp-parity.ts \
  --live http://localhost:3000/mcp \
  --header "X-API-Key: <your-key>"
```

Expected: `Missing in MCP: 0`, `Extra in MCP: 0`, exit code 0.

## 6. End-to-end from Claude Code

```bash
claude mcp remove elnora
claude mcp add elnora --transport http --scope user \
  http://localhost:3000/mcp --header "X-API-Key: <your-key>"
```

In a Claude Code session ask: "List my projects via the elnora MCP server."
Verify the tool that gets called is `elnora_projects_list` and it returns
real data.

## 7. Teardown

```bash
docker compose down                                              # MCP redis
cd ../elnora-platform-elnora-2.0 && npm run docker:down          # platform
```
