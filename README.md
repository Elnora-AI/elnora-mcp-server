# Elnora MCP Server

Connect AI agents to the [Elnora](https://elnora.ai) bioprotocol optimization platform via the [Model Context Protocol](https://modelcontextprotocol.io).

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

## What is Elnora?

Elnora is an AI-powered platform that helps researchers generate, optimize, and manage bioprotocols for wet-lab experiments. With this MCP server, you can interact with Elnora directly from AI coding assistants like Claude Code, Cursor, VS Code, Codex, and ChatGPT.

## Quick Start

Add the Elnora MCP server to your AI client. No installation required — just point to the remote URL.

### Claude Code

```bash
claude mcp add elnora --transport http --scope user https://mcp.elnora.ai/mcp
```

**Installation scopes:**

| Scope | Flag | Where it's stored | Best for |
|-------|------|--------------------|----------|
| User | `--scope user` | `~/.claude.json` | Available in all your projects (recommended) |
| Local | `--scope local` | Current project config | Single-project use (default if omitted) |
| Project | `--scope project` | `.mcp.json` in project root | Team sharing via version control |

### Cursor

Add to your Cursor MCP settings (Settings > MCP Servers):

```json
{
  "mcpServers": {
    "elnora": {
      "url": "https://mcp.elnora.ai/mcp"
    }
  }
}
```

### VS Code (Copilot)

Add to your `.vscode/mcp.json`:

```json
{
  "servers": {
    "elnora": {
      "type": "http",
      "url": "https://mcp.elnora.ai/mcp"
    }
  }
}
```

### Codex

```bash
codex --mcp-config mcp.json
```

With `mcp.json`:

```json
{
  "mcpServers": {
    "elnora": {
      "url": "https://mcp.elnora.ai/mcp"
    }
  }
}
```

### ChatGPT

Add as a remote MCP server in ChatGPT settings using the URL `https://mcp.elnora.ai/mcp`.

---

On first connection, a browser window will open for OAuth login. Subsequent requests use the issued token automatically.

## Authentication

### OAuth 2.1 (Recommended)

Most MCP clients handle OAuth automatically. On first connection:

1. A browser window opens for login
2. You authenticate with your Elnora account
3. The client receives a token and uses it for subsequent requests

No manual configuration needed.

### API Key

Create an API key in your [Elnora dashboard](https://platform.elnora.ai) and pass it via the `X-API-Key` header:

```json
{
  "mcpServers": {
    "elnora": {
      "url": "https://mcp.elnora.ai/mcp",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

**Security best practices:**
- Never commit API keys to version control
- Use environment variables or a secrets manager
- Rotate keys periodically via the Elnora dashboard
- Use OAuth when possible — it handles token refresh automatically

## Capabilities

74 tools across 15 categories. All tools are discoverable through your MCP client's tool listing.

| Category | Tools | What you can do |
|----------|------:|-----------------|
| Protocols | 1 | Generate optimized bioprotocols from natural language descriptions |
| Tasks | 6 | Create conversation threads, send messages, get AI responses |
| Messages | 1 | Chat with Elnora's AI within a task context |
| Files | 18 | Upload, download, version, fork, and manage protocol files |
| Projects | 10 | Create projects and manage team membership |
| Organizations | 13 | Org settings, billing, member invitations |
| Folders | 5 | Organize files into nested folder structures |
| Library | 5 | Access the organization's shared protocol library |
| Search | 3 | Full-text search across tasks, files, and all resources |
| API Keys | 3 | Create and manage personal API keys |
| Audit | 1 | Query organization audit logs |
| Account | 4 | Manage user profile and agreements |
| Feedback | 1 | Submit platform feedback |
| Feature Flags | 2 | Check feature availability |
| Health | 1 | Verify API connectivity |

## Examples

### Generate a bioprotocol

> "Use Elnora to generate a HEK 293 cell maintenance protocol"

The assistant will call `elnora_generate_protocol` with your description and return the generated protocol. This can take 30-120s for complex requests.

### Search and read files

> "List my files in Elnora, then show me the content of the most recent protocol"

### Manage tasks

> "Show me my active Elnora tasks and get the messages from the latest one"

### Organize a project

> "Create a new project called 'Q3 Assays', add a folder for each cell line, and invite alex@example.com"

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Missing or expired token | Re-authenticate via OAuth or check your API key |
| 403 Forbidden | Insufficient permissions | Verify your account has access to the requested resource |
| 408 / Timeout | Complex operation taking too long | Protocol generation can take up to 120s — try again or simplify the request |
| Connection refused | Server unreachable | Check your internet connection; verify `https://mcp.elnora.ai/health` is accessible |

If you encounter persistent issues, please [open a GitHub issue](https://github.com/Elnora-AI/elnora-mcp-server/issues).

## Security

We take security seriously. If you discover a vulnerability, please report it responsibly — see our [security policy](.github/SECURITY.md).

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for contribution guidelines.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

[Apache License 2.0](LICENSE)

## Support

- **Bug reports and feature requests:** [GitHub Issues](https://github.com/Elnora-AI/elnora-mcp-server/issues)
- **Account and billing:** [support@elnora.ai](mailto:support@elnora.ai)
- **Security vulnerabilities:** [security@elnora.ai](mailto:security@elnora.ai)
