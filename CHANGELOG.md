# Changelog

All notable changes to the Elnora MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.6.0](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.5.2...mcp-server-v0.6.0) (2026-03-07)


### Features

* **mcp:** add org_id support to ElnoraApiClient and org-scoped tools ([11f8cac](https://github.com/Elnora-AI/elnora-mcp-server/commit/11f8cac92c2cbc1f13cb68d5bf1eeef85812f845))


### Bug Fixes

* **auth:** add X-Service-Key header and use SDK error types ([#26](https://github.com/Elnora-AI/elnora-mcp-server/issues/26)) ([9ae49ee](https://github.com/Elnora-AI/elnora-mcp-server/commit/9ae49ee6ce9b84d74306757ceaceb24fa0338dc0))

## [0.5.2](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.5.1...mcp-server-v0.5.2) (2026-03-06)


### Bug Fixes

* **ci:** allow same version in publish workflow ([#23](https://github.com/Elnora-AI/elnora-mcp-server/issues/23)) ([134a6a2](https://github.com/Elnora-AI/elnora-mcp-server/commit/134a6a236938c238d9e425a2e9cb2907bbcd7342))

## [0.5.1](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.5.0...mcp-server-v0.5.1) (2026-03-06)


### Bug Fixes

* **ci:** extract semver from release-please component tags ([#21](https://github.com/Elnora-AI/elnora-mcp-server/issues/21)) ([9e47c13](https://github.com/Elnora-AI/elnora-mcp-server/commit/9e47c1398b225694beb3b911103069e2e3fba7f8))

## [0.5.0](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.4.2...mcp-server-v0.5.0) (2026-03-06)


### ⚠ BREAKING CHANGES

* security hardening, auth overhaul, CI/CD fixes, expanded tool coverage, and documentation refresh

### Features

* security hardening, auth overhaul, CI/CD fixes, expanded tool coverage, and documentation refresh ([ebcdcb1](https://github.com/Elnora-AI/elnora-mcp-server/commit/ebcdcb144c457104d3e29fbb4bb680024db29df4))


### Bug Fixes

* sync package version to 0.4.3 and add version extraction to publish workflow ([4433c44](https://github.com/Elnora-AI/elnora-mcp-server/commit/4433c4483b4f505eba5b68de0fab71af30d2a547))
* use HMAC for rate-limiter key hashing to satisfy CodeQL ([3bcf13c](https://github.com/Elnora-AI/elnora-mcp-server/commit/3bcf13c6b8ed6ee4580f47c9c7eca39aa6abac56))
* use non-crypto hash for rate-limiter keys to resolve CodeQL alert ([3588066](https://github.com/Elnora-AI/elnora-mcp-server/commit/358806634b27acead8238732fb53ce7da85d8ebb))

## [0.4.2](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.4.1...mcp-server-v0.4.2) (2026-03-06)


### Bug Fixes

* use ipKeyGenerator to resolve express-rate-limit IPv6 warning ([#16](https://github.com/Elnora-AI/elnora-mcp-server/issues/16)) ([61778a4](https://github.com/Elnora-AI/elnora-mcp-server/commit/61778a4ddd2e5054b0b565651b6e5ef8422e3e0e))

## [0.4.1](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.4.0...mcp-server-v0.4.1) (2026-03-06)


### Bug Fixes

* default HOST to 0.0.0.0 so ECS health checks can connect ([#14](https://github.com/Elnora-AI/elnora-mcp-server/issues/14)) ([8fa4c8c](https://github.com/Elnora-AI/elnora-mcp-server/commit/8fa4c8cc0cf4aaead25e9b910bce936c12b96360))

## [0.4.0](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.3.0...mcp-server-v0.4.0) (2026-03-06)


### Features

* add API key auth, expand tool coverage, and harden security ([#11](https://github.com/Elnora-AI/elnora-mcp-server/issues/11)) ([3d51d39](https://github.com/Elnora-AI/elnora-mcp-server/commit/3d51d393b800f80f2489a5d49223015948f5b559))

## [0.3.0](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.2.0...mcp-server-v0.3.0) (2026-03-05)


### Features

* add release-please for automatic changelog and npm publishing ([#9](https://github.com/Elnora-AI/elnora-mcp-server/issues/9)) ([3812bc2](https://github.com/Elnora-AI/elnora-mcp-server/commit/3812bc22cdfb832710d947895209b98aba178570))
* **auth:** OAuth 2.1 proxy AS with SDK v1.27 ([#5](https://github.com/Elnora-AI/elnora-mcp-server/issues/5)) ([4151229](https://github.com/Elnora-AI/elnora-mcp-server/commit/41512290fa1c1690adeb08a32040c78fd712e175))
* initial release of Elnora MCP Server ([a9a17f9](https://github.com/Elnora-AI/elnora-mcp-server/commit/a9a17f90a127aec7c98f62d43549a33a60ce893e))
* prepare for MCP Registry registration ([#2](https://github.com/Elnora-AI/elnora-mcp-server/issues/2)) ([3ecf8fc](https://github.com/Elnora-AI/elnora-mcp-server/commit/3ecf8fc803b1b7dba4333faf5eca44766cc70c6a))


### Bug Fixes

* **ci:** re-add --provenance flag now that repo is public ([9da065b](https://github.com/Elnora-AI/elnora-mcp-server/commit/9da065bbd52859bd969f00c8604d596e2a889976))
* **ci:** remove --provenance flag for private repo npm publish ([325d405](https://github.com/Elnora-AI/elnora-mcp-server/commit/325d4051ae19a760d0a84bcd3cf321ea8e802b30))
* **ci:** skip CodeQL on private repos ([abdf017](https://github.com/Elnora-AI/elnora-mcp-server/commit/abdf017fb229c84a7f07c5d1a3e235c5ad7f1d93))
* **docs:** correct MCP transport type in client setup instructions ([#4](https://github.com/Elnora-AI/elnora-mcp-server/issues/4)) ([191128a](https://github.com/Elnora-AI/elnora-mcp-server/commit/191128a0d609b2199520145bc8f0d2e7415d3ee0))
* raise limits for real-world usage, add MCP spec-compliant 405 handlers ([#6](https://github.com/Elnora-AI/elnora-mcp-server/issues/6)) ([05c393c](https://github.com/Elnora-AI/elnora-mcp-server/commit/05c393cd7ce3c6a09962572dfb97e349b643806d))
* use correct transport type key in server.json remotes ([#3](https://github.com/Elnora-AI/elnora-mcp-server/issues/3)) ([518fc62](https://github.com/Elnora-AI/elnora-mcp-server/commit/518fc62093cfa294950c8b1a0abc450aca6b4a49))

## [Unreleased]

## [0.1.0] - 2026-02-27

### Added

- Initial release of Elnora MCP Server
- 8 MCP tools: `elnora_create_task`, `elnora_list_tasks`, `elnora_get_task_messages`,
  `elnora_send_message`, `elnora_list_files`, `elnora_get_file_content`,
  `elnora_upload_file`, `elnora_generate_protocol`
- HTTP transport (Streamable HTTP) with OAuth 2.1 and API key authentication
- Protected Resource Metadata endpoint (RFC 9728)
- Health check endpoint
