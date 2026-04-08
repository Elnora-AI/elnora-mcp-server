# Changelog

All notable changes to the Elnora MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.12.2](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.12.1...mcp-server-v0.12.2) (2026-04-08)


### Bug Fixes

* **ci:** add GitHub issue cross-references to auto-fix PRs ([#132](https://github.com/Elnora-AI/elnora-mcp-server/issues/132)) ([e2fd917](https://github.com/Elnora-AI/elnora-mcp-server/commit/e2fd91790b715ac1b774c59ac4d5179fa59d10f5))
* **ci:** use correct model ID for claude-code-action ([#127](https://github.com/Elnora-AI/elnora-mcp-server/issues/127)) ([cbc249b](https://github.com/Elnora-AI/elnora-mcp-server/commit/cbc249bfc3610f162efb9fec2e0d00e85cd09ea6))
* **deps:** automated vulnerability remediation 2026-04-08 ([#131](https://github.com/Elnora-AI/elnora-mcp-server/issues/131)) ([35bb647](https://github.com/Elnora-AI/elnora-mcp-server/commit/35bb647ad7f9ac6010eb6948a74ce9d112feb76b))

## [0.12.1](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.12.0...mcp-server-v0.12.1) (2026-04-08)


### Bug Fixes

* **ci:** correct claude-code-action parameters and permissions ([#125](https://github.com/Elnora-AI/elnora-mcp-server/issues/125)) ([e9d2d48](https://github.com/Elnora-AI/elnora-mcp-server/commit/e9d2d48f501f1d326d2915c3c22578ad55160161))

## [0.12.0](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.11.1...mcp-server-v0.12.0) (2026-04-08)


### Features

* **ci:** automated vulnerability remediation pipeline ([#123](https://github.com/Elnora-AI/elnora-mcp-server/issues/123)) ([2b32240](https://github.com/Elnora-AI/elnora-mcp-server/commit/2b322406164a709cce06f2c6c7b342b76bd0002a))

## [0.11.1](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.11.0...mcp-server-v0.11.1) (2026-04-08)


### Bug Fixes

* **deps:** patch vite to &gt;=8.0.5 for SEC-304, SEC-305, SEC-306 ([#112](https://github.com/Elnora-AI/elnora-mcp-server/issues/112)) ([15b5b8e](https://github.com/Elnora-AI/elnora-mcp-server/commit/15b5b8eb394470c0fb42908f8b49be8080a00581))

## [0.11.0](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.10.6...mcp-server-v0.11.0) (2026-03-31)


### Features

* consume platform refresh tokens for 30-day MCP sessions (ELN-513) ([#100](https://github.com/Elnora-AI/elnora-mcp-server/issues/100)) ([a04e6c6](https://github.com/Elnora-AI/elnora-mcp-server/commit/a04e6c697abd87e0043448770211ab09e15b7a03))

## [0.10.6](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.10.5...mcp-server-v0.10.6) (2026-03-31)


### Bug Fixes

* **deps:** resolve SEC-274, SEC-275, SEC-276 dependency vulnerabilities ([#98](https://github.com/Elnora-AI/elnora-mcp-server/issues/98)) ([4d8e3a0](https://github.com/Elnora-AI/elnora-mcp-server/commit/4d8e3a0bae52676ee6dfb23f89ca22cf366833a3))

## [0.10.5](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.10.4...mcp-server-v0.10.5) (2026-03-30)


### Bug Fixes

* persist OAuth client registrations in Redis (ELN-570) ([#96](https://github.com/Elnora-AI/elnora-mcp-server/issues/96)) ([1f04d9d](https://github.com/Elnora-AI/elnora-mcp-server/commit/1f04d9d050f7ea2d886f7a08d332bb21d8a107cb))

## [0.10.4](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.10.3...mcp-server-v0.10.4) (2026-03-27)


### Bug Fixes

* retrigger release-please after branch cleanup ([#88](https://github.com/Elnora-AI/elnora-mcp-server/issues/88)) ([da04df0](https://github.com/Elnora-AI/elnora-mcp-server/commit/da04df0840d60cf7af0e19071ebc013da6d2a10e))
* update node:24-slim base image digest ([#87](https://github.com/Elnora-AI/elnora-mcp-server/issues/87)) ([0b47813](https://github.com/Elnora-AI/elnora-mcp-server/commit/0b4781389f999b1548d979b939b8c1a18f4cfa8f))

## [0.10.3](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.10.2...mcp-server-v0.10.3) (2026-03-27)


### Bug Fixes

* trigger release for dependency security patches ([#85](https://github.com/Elnora-AI/elnora-mcp-server/issues/85)) ([b475c8a](https://github.com/Elnora-AI/elnora-mcp-server/commit/b475c8a0d9fdade0fb3e3e34c6747e3cef5487e9))

## [0.10.2](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.10.1...mcp-server-v0.10.2) (2026-03-26)


### Bug Fixes

* upgrade picomatch to 4.0.4 for CVE-2026-33672 ([#76](https://github.com/Elnora-AI/elnora-mcp-server/issues/76)) ([1ad0824](https://github.com/Elnora-AI/elnora-mcp-server/commit/1ad0824fe465f67b7de1dcde0db1d6b9eb5163e0))

## [0.10.1](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.10.0...mcp-server-v0.10.1) (2026-03-24)


### Bug Fixes

* override tar and minimatch to resolve remaining CVEs ([#70](https://github.com/Elnora-AI/elnora-mcp-server/issues/70)) ([4e280c8](https://github.com/Elnora-AI/elnora-mcp-server/commit/4e280c840a9ac4255a6f662f331d032737a4a694))

## [0.10.0](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.9.1...mcp-server-v0.10.0) (2026-03-24)


### Features

* upgrade from Node 22 to Node 24 LTS ([#68](https://github.com/Elnora-AI/elnora-mcp-server/issues/68)) ([d47ae00](https://github.com/Elnora-AI/elnora-mcp-server/commit/d47ae004384426a53e7f03be8cef961de923d1af))

## [0.9.1](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.9.0...mcp-server-v0.9.1) (2026-03-23)


### Bug Fixes

* enable trust proxy for ALB compatibility ([#35](https://github.com/Elnora-AI/elnora-mcp-server/issues/35)) ([c942b08](https://github.com/Elnora-AI/elnora-mcp-server/commit/c942b08c36f3d072e29b141983586024c1f68027))
* filter Inspector findings to MCP server ECR repo only ([#65](https://github.com/Elnora-AI/elnora-mcp-server/issues/65)) ([6d5f773](https://github.com/Elnora-AI/elnora-mcp-server/commit/6d5f7733ba79650e930d838d5e92b98f9f739240))
* resolve 13 AWS Inspector vulnerabilities ([#66](https://github.com/Elnora-AI/elnora-mcp-server/issues/66)) ([4117764](https://github.com/Elnora-AI/elnora-mcp-server/commit/41177647e774315c6f2c88c0aa3b5a5816e3acc5))

## [0.9.0](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.8.0...mcp-server-v0.9.0) (2026-03-14)


### Features

* **security:** harden API client and add response formatting ([#33](https://github.com/Elnora-AI/elnora-mcp-server/issues/33)) ([f52997f](https://github.com/Elnora-AI/elnora-mcp-server/commit/f52997f9761db988d6422d3593ce5d27dfe4f79c))

## [0.8.0](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.7.0...mcp-server-v0.8.0) (2026-03-12)


### Features

* **ci:** switch from static AWS keys to OIDC federation ([36e10c9](https://github.com/Elnora-AI/elnora-mcp-server/commit/36e10c92261273f5469521ffb57115f6e428201c))
* **ci:** switch GitHub Actions from static AWS keys to OIDC federation ([#32](https://github.com/Elnora-AI/elnora-mcp-server/issues/32)) ([5b44bfb](https://github.com/Elnora-AI/elnora-mcp-server/commit/5b44bfbcd780dab1356ccabfc47a5899d91768c9))


### Reverts

* undo direct-to-main OIDC change (will redo as PR) ([153a87f](https://github.com/Elnora-AI/elnora-mcp-server/commit/153a87f4ea5063a5a2f48d8bb47ae622468189a6))

## [0.7.0](https://github.com/Elnora-AI/elnora-mcp-server/compare/mcp-server-v0.6.0...mcp-server-v0.7.0) (2026-03-09)


### Features

* **auth:** Redis-backed token persistence ([#28](https://github.com/Elnora-AI/elnora-mcp-server/issues/28)) ([87b265a](https://github.com/Elnora-AI/elnora-mcp-server/commit/87b265a154a3e16e69e0d6bc663d22622fe95239))

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
