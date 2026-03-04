# Elnora MCP Server

Connect AI agents to the [Elnora](https://elnora.ai) bioprotocol optimization platform via the [Model Context Protocol](https://modelcontextprotocol.io).

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

## What is Elnora?

Elnora is an AI-powered platform that helps researchers generate, optimize, and manage bioprotocols for wet-lab experiments. With this MCP server, you can interact with Elnora directly from AI coding assistants like Claude Code, Codex, Cursor, VS Code, and ChatGPT.

## Quick Start

Add the Elnora MCP server to your AI client. No installation required — just point to the remote URL.

### Claude Code

```bash
claude mcp add elnora --transport http https://mcp.elnora.ai/mcp
```

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

## Available Tools

### Tasks

| Tool | Description |
|------|-------------|
| `elnora_create_task` | Create a new task (conversation thread) for interacting with Elnora's AI |
| `elnora_list_tasks` | List tasks in your workspace with optional status filter |
| `elnora_get_task_messages` | Get the message history for a specific task |

### Messages

| Tool | Description |
|------|-------------|
| `elnora_send_message` | Send a message to a task and receive an AI response (30-120s for complex requests) |

### Files

| Tool | Description |
|------|-------------|
| `elnora_list_files` | List files in your workspace with optional project filter |
| `elnora_get_file_content` | Retrieve the content of a specific file |
| `elnora_upload_file` | Upload a text file to your workspace |

### Protocols

| Tool | Description |
|------|-------------|
| `elnora_generate_protocol` | Generate a bioprotocol — creates a task, sends your description, and returns the result |

## Authentication

### OAuth 2.1 (Recommended)

Most MCP clients handle OAuth automatically. On first connection:

1. A browser window opens for login
2. You authenticate with your Elnora account
3. The client receives a token and uses it for subsequent requests

No manual configuration needed.

### API Key

Alternatively, create an API key in your [Elnora dashboard](https://platform.elnora.ai) and pass it as a Bearer token:

```json
{
  "mcpServers": {
    "elnora": {
      "url": "https://mcp.elnora.ai/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
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

## Examples

### Generate a bioprotocol

Ask your AI assistant:

> "Use Elnora to generate a HEK 293 cell maintenance protocol"

The assistant will call `elnora_generate_protocol` with your description and return the generated protocol.

### Search and read files

> "List my files in Elnora, then show me the content of the most recent protocol"

The assistant will call `elnora_list_files` followed by `elnora_get_file_content`.

### Manage tasks

> "Show me my active Elnora tasks and get the messages from the latest one"

The assistant will call `elnora_list_tasks` and then `elnora_get_task_messages`.

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

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for contribution guidelines.

## License

This project is licensed under the [Apache License 2.0](LICENSE).

## Support

- **Bug reports and feature requests:** [GitHub Issues](https://github.com/Elnora-AI/elnora-mcp-server/issues)
- **Account and billing questions:** [support@elnora.ai](mailto:support@elnora.ai)
- **Security vulnerabilities:** [security@elnora.ai](mailto:security@elnora.ai)
