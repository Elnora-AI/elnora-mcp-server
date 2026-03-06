# Elnora MCP Server

Connect AI agents to the [Elnora](https://elnora.ai) bioprotocol optimization platform via the [Model Context Protocol](https://modelcontextprotocol.io).

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

## What is Elnora?

Elnora is an AI-powered platform that helps researchers generate, optimize, and manage bioprotocols for wet-lab experiments. With this MCP server, you can interact with Elnora directly from AI coding assistants like Claude Code, Codex, Cursor, VS Code, and ChatGPT.

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

```bash
# Personal — available everywhere (recommended)
claude mcp add elnora --transport http --scope user https://mcp.elnora.ai/mcp

# Project — shared with your team via git
claude mcp add elnora --transport http --scope project https://mcp.elnora.ai/mcp
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

74 tools across 15 categories. Every tool includes scope-based access control.

### Tasks (6 tools)

| Tool | Description |
|------|-------------|
| `elnora_create_task` | Create a new task (conversation thread) with optional initial message and context files |
| `elnora_list_tasks` | List tasks with optional project and status filters |
| `elnora_get_task` | Get a single task by UUID |
| `elnora_get_task_messages` | Get paginated message history for a task |
| `elnora_update_task` | Update task title or status |
| `elnora_archive_task` | Archive (delete) a task |

### Messages (1 tool)

| Tool | Description |
|------|-------------|
| `elnora_send_message` | Send a message to a task and receive the AI response (30-120s for complex requests) |

### Files (18 tools)

| Tool | Description |
|------|-------------|
| `elnora_list_files` | List files in a project or workspace |
| `elnora_get_file` | Get file metadata by UUID |
| `elnora_get_file_content` | Retrieve file content |
| `elnora_get_file_versions` | Get version history for a file |
| `elnora_get_version_content` | Get content of a specific file version |
| `elnora_upload_file` | Upload a text file |
| `elnora_create_file` | Create a new empty file in a project |
| `elnora_update_file` | Update file metadata (rename or move) |
| `elnora_archive_file` | Archive (delete) a file |
| `elnora_download_file` | Download a file (returns download URL or content) |
| `elnora_create_version` | Create a new version of a file |
| `elnora_restore_version` | Restore a file to a specific version |
| `elnora_promote_file` | Promote file visibility (e.g., to organization library) |
| `elnora_fork_file` | Fork a file to another project |
| `elnora_create_working_copy` | Create a working copy for editing |
| `elnora_commit_working_copy` | Commit a working copy back to the file |
| `elnora_initiate_upload` | Initiate a multi-step upload (returns presigned URL) |
| `elnora_confirm_upload` | Confirm that a presigned upload has completed |

### Protocols (1 tool)

| Tool | Description |
|------|-------------|
| `elnora_generate_protocol` | Generate a bioprotocol — creates a task, sends your description, and returns the result (30-120s) |

### Projects (10 tools)

| Tool | Description |
|------|-------------|
| `elnora_list_projects` | List all projects |
| `elnora_get_project` | Get a single project by UUID |
| `elnora_create_project` | Create a new project |
| `elnora_update_project` | Update project metadata |
| `elnora_archive_project` | Archive (soft-delete) a project |
| `elnora_list_project_members` | List members of a project |
| `elnora_add_project_member` | Add a user to a project |
| `elnora_update_project_member_role` | Change a project member's role |
| `elnora_remove_project_member` | Remove a user from a project |
| `elnora_leave_project` | Leave a project you are a member of |

### Organizations (13 tools)

| Tool | Description |
|------|-------------|
| `elnora_list_orgs` | List organizations you belong to |
| `elnora_get_org` | Get organization details |
| `elnora_create_org` | Create a new organization |
| `elnora_update_org` | Update organization metadata |
| `elnora_list_org_members` | List organization members |
| `elnora_update_org_member_role` | Change a member's role |
| `elnora_remove_org_member` | Remove a member |
| `elnora_get_org_billing` | Get billing status |
| `elnora_invite_org_member` | Send an invitation to join |
| `elnora_list_org_invitations` | List pending invitations |
| `elnora_cancel_org_invitation` | Cancel a pending invitation |
| `elnora_get_invitation_info` | Get invitation details by token (no auth required) |
| `elnora_accept_invitation` | Accept an organization invitation |

### Folders (5 tools)

| Tool | Description |
|------|-------------|
| `elnora_list_folders` | List folders in a project |
| `elnora_create_folder` | Create a folder (supports nesting) |
| `elnora_rename_folder` | Rename a folder |
| `elnora_move_folder` | Move a folder to a new parent |
| `elnora_delete_folder` | Delete a folder |

### Library (5 tools)

| Tool | Description |
|------|-------------|
| `elnora_list_library_files` | List files in the organization shared library |
| `elnora_list_library_folders` | List folders in the shared library |
| `elnora_create_library_folder` | Create a library folder |
| `elnora_rename_library_folder` | Rename a library folder |
| `elnora_delete_library_folder` | Delete a library folder |

### Search (3 tools)

| Tool | Description |
|------|-------------|
| `elnora_search_tasks` | Full-text search across tasks |
| `elnora_search_files` | Full-text search across files |
| `elnora_search_all` | Full-text search across all resources |

### API Keys (3 tools)

| Tool | Description |
|------|-------------|
| `elnora_list_api_keys` | List all personal API keys |
| `elnora_create_api_key` | Create a new API key |
| `elnora_revoke_api_key` | Revoke (delete) an API key |

### Audit (1 tool)

| Tool | Description |
|------|-------------|
| `elnora_list_audit_log` | List organization audit log entries (filterable by action and user) |

### Account (4 tools)

| Tool | Description |
|------|-------------|
| `elnora_get_account` | Get user account details |
| `elnora_update_account` | Update user account name |
| `elnora_list_agreements` | List user agreements (terms of service) |
| `elnora_accept_terms` | Accept a user agreement version |

### Feedback (1 tool)

| Tool | Description |
|------|-------------|
| `elnora_submit_feedback` | Submit feedback about the Elnora platform |

### Feature Flags (2 tools)

| Tool | Description |
|------|-------------|
| `elnora_list_flags` | List all feature flags (public, no auth required) |
| `elnora_get_flag` | Get a single feature flag by key |

### Health (1 tool)

| Tool | Description |
|------|-------------|
| `elnora_health_check` | Check if the Elnora platform API is reachable |

## Authentication

### OAuth 2.1 (Recommended)

Most MCP clients handle OAuth automatically. On first connection:

1. A browser window opens for login
2. You authenticate with your Elnora account
3. The client receives a token and uses it for subsequent requests

No manual configuration needed.

### API Key

Alternatively, create an API key in your [Elnora dashboard](https://platform.elnora.ai) and pass it via the `X-API-Key` header:

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
