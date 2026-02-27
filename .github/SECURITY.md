# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.x.x   | Yes       |

## Reporting a Vulnerability

**DO NOT open a public GitHub issue for security vulnerabilities.**

Please report security vulnerabilities via one of the following channels:

- **Email:** [security@elnora.ai](mailto:security@elnora.ai)
- **GitHub Security Advisories:** [Report a vulnerability](https://github.com/Elnora-AI/elnora-mcp-server/security/advisories/new)

Include as much detail as possible:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Response Timeline

- **Acknowledgement:** Within 48 hours of report
- **Initial assessment:** Within 5 business days
- **Fix and disclosure:** Within 90 days of report

## Responsible Disclosure

We follow a 90-day disclosure timeline. We ask that you:

- Allow us reasonable time to fix the issue before public disclosure
- Do not access or modify other users' data
- Do not perform actions that could negatively impact other users
- Act in good faith to avoid privacy violations, data destruction, and service disruption

## Scope

**In scope:**

- The Elnora MCP server code in this repository
- The Elnora API as accessed through MCP tools

**Out of scope:**

- Third-party dependencies (please report to their respective maintainers)
- Social engineering attacks against Elnora staff
- Denial of service attacks
- Issues in services not operated by Elnora

## Security Best Practices for Users

- Never commit API keys or tokens to version control
- Use environment variables or a secrets manager for credentials
- Pin the MCP server version in your configuration
- Review tool permissions before granting access to AI agents
- Use OAuth 2.1 when possible — it handles token refresh and revocation automatically
