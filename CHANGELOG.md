# Changelog

All notable changes to the Elnora MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
