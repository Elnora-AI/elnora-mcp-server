/**
 * MCP catalog generator for docs.elnora.ai.
 *
 * Runs every tool-registration function against a mock MCP server to capture the
 * exact tools the server exposes (name, description, annotations, input schema),
 * then emits one MDX page per category + a connection guide + meta.json for the
 * Fumadocs developer portal. Because it executes the real registrations, the
 * catalog can never drift from the deployed MCP server.
 *
 * Usage: tsx scripts/gen-docs-reference.ts --out ../elnora-docs/content/docs/mcp
 */

import { mkdirSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

import { registerTaskTools } from "../src/tools/tasks.js";
import { registerFileTools } from "../src/tools/files.js";
import { registerProtocolTools } from "../src/tools/protocols.js";
import { registerProjectTools } from "../src/tools/projects.js";
import { registerOrgTools } from "../src/tools/orgs.js";
import { registerFolderTools } from "../src/tools/folders.js";
import { registerLibraryTools } from "../src/tools/library.js";
import { registerSearchTools } from "../src/tools/search.js";
import { registerApiKeyTools } from "../src/tools/api-keys.js";
import { registerAuditTools } from "../src/tools/audit.js";
import { registerAccountTools } from "../src/tools/account.js";
import { registerFeedbackTools } from "../src/tools/feedback.js";
import { registerFlagTools } from "../src/tools/flags.js";
import { registerHealthTools } from "../src/tools/health.js";
import { OUTPUT_OPTIONS_SCHEMA } from "../src/services/response-formatter.js";

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
let outArg = "../elnora-docs/content/docs/mcp";
for (let i = 0; i < argv.length; i++) {
	if (argv[i] === "--out" && argv[i + 1]) {
		outArg = argv[i + 1];
		i++;
	}
}
const outDir = resolve(process.cwd(), outArg);
const OUTPUT_FIELDS = new Set(Object.keys(OUTPUT_OPTIONS_SCHEMA));

// ---------------------------------------------------------------------------
// capture tools via a mock server
// ---------------------------------------------------------------------------
interface ToolConfig {
	title?: string;
	description?: string;
	inputSchema?: Record<string, unknown>;
	annotations?: Record<string, unknown>;
}
interface Captured {
	name: string;
	config: ToolConfig;
	category: string;
}

const tools: Captured[] = [];
let currentCategory = "";

// A no-op that survives any property access or call (e.g. `.enable()` chains).
const noopChain: unknown = new Proxy(function () {}, {
	get: () => noopChain,
	apply: () => noopChain,
});
const mockServer: unknown = new Proxy(
	{},
	{
		get(_t, prop) {
			if (prop === "registerTool") {
				return (name: string, config: ToolConfig) => {
					tools.push({ name, config: config ?? {}, category: currentCategory });
					return noopChain;
				};
			}
			return () => noopChain;
		},
	},
);
const stubGetClient = () => new Proxy({}, { get: () => () => {} });
const stubGetContext = () => ({ client: stubGetClient(), clientId: "stub", scopes: [] as string[] });

const REGISTRATIONS: [string, (s: any, gc: any, gx: any) => void][] = [
	["tasks", registerTaskTools],
	["files", registerFileTools],
	["protocols", registerProtocolTools],
	["projects", registerProjectTools],
	["orgs", registerOrgTools],
	["folders", registerFolderTools],
	["library", registerLibraryTools],
	["search", registerSearchTools],
	["api-keys", registerApiKeyTools],
	["audit", registerAuditTools],
	["account", registerAccountTools],
	["feedback", registerFeedbackTools],
	["flags", registerFlagTools],
	["health", registerHealthTools],
];

for (const [cat, fn] of REGISTRATIONS) {
	currentCategory = cat;
	// biome-ignore lint/suspicious/noExplicitAny: mock server intentionally untyped
	fn(mockServer as any, stubGetClient as any, stubGetContext as any);
}

// ---------------------------------------------------------------------------
// exclude staff-only tools from the PUBLIC catalog
// ---------------------------------------------------------------------------
// docs.elnora.ai is public. A handful of tools are SystemAdmin/staff-only (they
// still work on the server for admins — this only stops them being *documented*).
// We filter by the same markers the docs safety-scan enforces, so the generated
// catalog can never trip the publish gate: an explicit name denylist (intent)
// plus the "(admin)" / "SystemAdmin" description convention (auto-covers any new
// staff-only tool that follows the same convention). The ToolAnnotations type is
// a closed zod object, so a per-tool `internal` annotation isn't an option — the
// docs generator is the right layer for this docs-publishing policy.
const INTERNAL_TOOL_NAMES = new Set([
	"elnora_account_users",
	"elnora_account_addLegalDoc",
	"elnora_account_updateLegalDoc",
	"elnora_account_deleteLegalDoc",
	"elnora_orgs_listAll",
]);
function isInternalTool(t: Captured): boolean {
	if (INTERNAL_TOOL_NAMES.has(t.name)) return true;
	const desc = t.config.description ?? "";
	return /\bSystemAdmin\b/.test(desc) || /\(admin\)/i.test(desc);
}
const excluded = tools.filter(isInternalTool).map((t) => t.name);
for (let i = tools.length - 1; i >= 0; i--) {
	if (isInternalTool(tools[i])) tools.splice(i, 1);
}
if (excluded.length) {
	console.log(`Excluded ${excluded.length} staff-only tool(s) from the public catalog: ${excluded.join(", ")}`);
}

// ---------------------------------------------------------------------------
// helpers (MDX + table safe) — mirror the CLI generator
// ---------------------------------------------------------------------------
function inlineText(s: string | undefined): string {
	return (s ?? "")
		.replace(/\r?\n+/g, " ")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/\{/g, "&#123;")
		.replace(/\}/g, "&#125;")
		.replace(/\|/g, "&#124;")
		.trim();
}
function frontmatterValue(s: string): string {
	return `"${(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n+/g, " ").trim()}"`;
}

interface ParamRow {
	name: string;
	type: string;
	required: boolean;
	description: string;
}

// The mcp-server is on zod 3 (no z.toJSONSchema), so introspect schemas directly.
// biome-ignore lint/suspicious/noExplicitAny: zod 3 internals are untyped here
type AnyZod = { _def?: any; description?: string };

function unwrap(s: AnyZod): {
	inner: AnyZod;
	optional: boolean;
	hasDefault: boolean;
	defaultValue: unknown;
} {
	let optional = false;
	let hasDefault = false;
	let defaultValue: unknown;
	let cur: AnyZod = s;
	for (let i = 0; i < 10 && cur?._def; i++) {
		const tn = cur._def.typeName;
		if (tn === "ZodOptional") {
			optional = true;
			cur = cur._def.innerType;
		} else if (tn === "ZodDefault") {
			hasDefault = true;
			try {
				defaultValue = cur._def.defaultValue();
			} catch {
				/* ignore */
			}
			cur = cur._def.innerType;
		} else if (tn === "ZodNullable") {
			cur = cur._def.innerType;
		} else {
			break;
		}
	}
	return { inner: cur, optional, hasDefault, defaultValue };
}

function zodType(s: AnyZod): { type: string; enumValues: unknown[] | null } {
	const def = s?._def;
	const tn = def?.typeName;
	switch (tn) {
		case "ZodString": {
			const checks = def.checks ?? [];
			// biome-ignore lint/suspicious/noExplicitAny: zod check shape
			const fmt = checks.find((c: any) => ["uuid", "email", "url", "datetime", "cuid"].includes(c.kind));
			return { type: fmt ? fmt.kind : "string", enumValues: null };
		}
		case "ZodNumber":
			return { type: "number", enumValues: null };
		case "ZodBoolean":
			return { type: "boolean", enumValues: null };
		case "ZodEnum":
			return { type: "enum", enumValues: def.values };
		case "ZodNativeEnum":
			return { type: "enum", enumValues: Object.values(def.values ?? {}) };
		case "ZodArray":
			return { type: `${zodType(def.type).type}[]`, enumValues: null };
		case "ZodObject":
		case "ZodRecord":
			return { type: "object", enumValues: null };
		case "ZodLiteral":
			return { type: typeof def.value, enumValues: [def.value] };
		case "ZodUnion": {
			const opts = (def.options ?? []).map((o: AnyZod) => zodType(unwrap(o).inner).type);
			return { type: Array.from(new Set(opts)).join(" \\| ") || "any", enumValues: null };
		}
		default:
			return { type: tn ? String(tn).replace(/^Zod/, "").toLowerCase() : "any", enumValues: null };
	}
}

function describe(s: AnyZod): string | undefined {
	return s?.description ?? s?._def?.description ?? undefined;
}

function paramRows(inputSchema: Record<string, unknown> | undefined): ParamRow[] {
	if (!inputSchema) return [];
	return Object.entries(inputSchema)
		.filter(([name]) => !OUTPUT_FIELDS.has(name))
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([name, raw]) => {
			const s = raw as AnyZod;
			const { inner, optional, hasDefault, defaultValue } = unwrap(s);
			const { type, enumValues } = zodType(inner);
			const parts: string[] = [];
			const desc = describe(s) ?? describe(inner);
			if (desc) parts.push(desc);
			if (enumValues) parts.push(`One of: ${enumValues.map((v) => `\`${String(v)}\``).join(", ")}.`);
			if (hasDefault && defaultValue !== undefined) parts.push(`Default: \`${String(defaultValue)}\`.`);
			return { name, type, required: !optional && !hasDefault, description: parts.join(" ") };
		});
}

function badges(annotations: Record<string, unknown> | undefined): string {
	if (!annotations) return "";
	const tags: string[] = [];
	if (annotations.readOnlyHint) tags.push("Read-only");
	if (annotations.destructiveHint) tags.push("Destructive");
	if (annotations.idempotentHint) tags.push("Idempotent");
	return tags.length ? `*${tags.join(" · ")}*\n\n` : "";
}

function renderTool(t: Captured): string {
	const rows = paramRows(t.config.inputSchema);
	let out = `## ${t.name}\n\n`;
	if (t.config.description) out += `${inlineText(t.config.description)}\n\n`;
	out += badges(t.config.annotations);
	if (rows.length) {
		out += "| Parameter | Type | Required | Description |\n";
		out += "| --- | --- | --- | --- |\n";
		for (const r of rows) {
			out += `| \`${r.name}\` | ${r.type} | ${r.required ? "yes" : "no"} | ${inlineText(r.description)} |\n`;
		}
		out += "\n";
	} else {
		out += "_No parameters._\n\n";
	}
	return out;
}

// ---------------------------------------------------------------------------
// category metadata
// ---------------------------------------------------------------------------
const CATEGORY: Record<string, { title: string; blurb: string }> = {
	tasks: { title: "Tasks", blurb: "Create tasks and drive the Elnora agent." },
	files: { title: "Files", blurb: "Upload, manage, and organize workspace files." },
	protocols: { title: "Protocols", blurb: "Generate and optimize bioprotocols." },
	projects: { title: "Projects", blurb: "Create and manage projects and members." },
	orgs: { title: "Organizations", blurb: "Manage organizations, members, and invitations." },
	folders: { title: "Folders", blurb: "Create and manage folders." },
	library: { title: "Library", blurb: "Manage your organization's shared library." },
	search: { title: "Search", blurb: "Search across your knowledge base and content." },
	"api-keys": { title: "API keys", blurb: "Create, list, and revoke API keys." },
	audit: { title: "Audit", blurb: "Read your organization's audit log." },
	account: { title: "Account", blurb: "Manage your account profile and agreements." },
	feedback: { title: "Feedback", blurb: "Submit product feedback." },
	flags: { title: "Feature flags", blurb: "Read feature flags." },
	health: { title: "Health", blurb: "Service health checks." },
};

// ---------------------------------------------------------------------------
// write
// ---------------------------------------------------------------------------
mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) {
	if (f.endsWith(".mdx") || f === "meta.json") rmSync(join(outDir, f));
}

const categoriesInOrder = REGISTRATIONS.map(([c]) => c);
for (const cat of categoriesInOrder) {
	const meta = CATEGORY[cat] ?? { title: cat, blurb: "" };
	const catTools = tools.filter((t) => t.category === cat).sort((a, b) => a.name.localeCompare(b.name));
	if (!catTools.length) continue;
	let body = `---\ntitle: ${frontmatterValue(meta.title)}\ndescription: ${frontmatterValue(meta.blurb)}\n---\n\n`;
	body += `${meta.blurb}\n\n`;
	for (const t of catTools) body += renderTool(t);
	writeFileSync(join(outDir, `${cat}.mdx`), body, "utf-8");
}

// connection guide (index) — stable; embedded here so the whole dir is generated
const indexBody = `---
title: "MCP & integrations"
description: "Connect Claude Code, Cursor, VS Code, and other AI tools to Elnora over the Model Context Protocol."
---

The **Elnora MCP server** lets AI tools call the Elnora platform directly over the
[Model Context Protocol](https://modelcontextprotocol.io). It exposes **${tools.length} tools**
across ${categoriesInOrder.length} categories — the same operations as the REST API and CLI.

- **Endpoint:** \`https://mcp.elnora.ai/mcp\` (remote, Streamable HTTP — nothing to install)
- **Health:** \`https://mcp.elnora.ai/health\`

## Authentication

Two options:

1. **OAuth 2.1** (default) — your client opens a browser to authorize on first connect.
2. **API key** — send your Elnora API key in the \`X-API-Key\` header (created in the dashboard).

## Connect your client

### Claude Code

\`\`\`bash
claude mcp add elnora --transport http --scope user https://mcp.elnora.ai/mcp
\`\`\`

### Cursor / VS Code / Codex (mcp.json)

\`\`\`json
{
  "mcpServers": {
    "elnora": {
      "url": "https://mcp.elnora.ai/mcp"
    }
  }
}
\`\`\`

## Tool catalog

${categoriesInOrder
	.filter((c) => tools.some((t) => t.category === c))
	.map((c) => {
		const meta = CATEGORY[c] ?? { title: c, blurb: "" };
		const n = tools.filter((t) => t.category === c).length;
		return `- [${meta.title}](/docs/mcp/${c}) — ${meta.blurb} (${n} tool${n === 1 ? "" : "s"})`;
	})
	.join("\n")}
`;
writeFileSync(join(outDir, "index.mdx"), indexBody, "utf-8");

const metaJson = {
	title: "MCP & integrations",
	pages: ["index", ...categoriesInOrder.filter((c) => tools.some((t) => t.category === c))],
};
writeFileSync(join(outDir, "meta.json"), `${JSON.stringify(metaJson, null, 2)}\n`, "utf-8");

console.log(`Generated MCP catalog: ${tools.length} tools / ${categoriesInOrder.length} categories -> ${outDir}`);
