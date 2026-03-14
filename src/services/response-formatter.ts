/**
 * Token-efficient response formatting for MCP tool results.
 *
 * Mirrors the elnora-cli's --compact and --fields flags:
 * - compact: strips null/undefined/empty values (saves ~30-40% tokens)
 * - fields: only includes specified fields in response objects
 *
 * Applied transparently by withGuard() — individual tool handlers don't
 * need to change. Non-JSON responses pass through untouched.
 */

import { z } from "zod";

/**
 * Shared Zod schema fragment for output options.
 * Spread this into any tool's inputSchema to enable compact/fields.
 */
export const OUTPUT_OPTIONS_SCHEMA = {
  compact: z.boolean().default(false).optional()
    .describe("Strip null/empty values from response to save tokens"),
  fields: z.string().optional()
    .describe("Comma-separated field names to include (e.g. 'id,name,status'). Applied to each item in paginated results."),
};

/**
 * Post-process a JSON string tool result with compact/fields options.
 * Returns the original string unchanged if no options are active or if
 * the string is not valid JSON.
 */
export function formatToolResult(
  jsonString: string,
  options: { compact?: boolean; fields?: string },
): string {
  if (!options.compact && !options.fields) return jsonString;

  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch {
    // Not JSON (e.g. raw file content) — return unchanged
    return jsonString;
  }

  if (options.fields) {
    const fieldList = options.fields.split(",").map((f) => f.trim()).filter(Boolean);
    if (fieldList.length > 0) {
      data = filterFields(data, fieldList);
    }
  }

  if (options.compact) {
    data = stripEmpty(data);
  }

  return JSON.stringify(data);
}

/**
 * Filter an API response to only include specified fields.
 * Handles paginated responses (items array) and single objects.
 * Pagination metadata (page, pageSize, totalCount, etc.) is always preserved.
 */
function filterFields(data: unknown, fields: string[]): unknown {
  if (data === null || data === undefined || typeof data !== "object") {
    return data;
  }

  const fieldSet = new Set(fields);

  // Paginated response: filter each item, keep pagination metadata
  if (Array.isArray(data)) {
    return data.map((item) => pickFields(item, fieldSet));
  }

  const obj = data as Record<string, unknown>;

  // Paginated response shape: { items: [...], page, pageSize, ... }
  if ("items" in obj && Array.isArray(obj.items)) {
    const paginationKeys = new Set([
      "page", "pageSize", "totalCount", "totalPages", "hasNextPage",
      "nextCursor", "hasMore",
    ]);
    const result: Record<string, unknown> = {};
    result.items = (obj.items as unknown[]).map((item) => pickFields(item, fieldSet));
    for (const [k, v] of Object.entries(obj)) {
      if (paginationKeys.has(k)) result[k] = v;
    }
    return result;
  }

  // Single object
  return pickFields(data, fieldSet);
}

function pickFields(item: unknown, fieldSet: Set<string>): unknown {
  if (item === null || item === undefined || typeof item !== "object" || Array.isArray(item)) {
    return item;
  }
  const obj = item as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const field of fieldSet) {
    if (field in obj) result[field] = obj[field];
  }
  return result;
}

/**
 * Recursively strip null, undefined, empty string, and empty array values.
 * Preserves boolean false, zero, and non-empty values.
 */
function stripEmpty(data: unknown): unknown {
  if (data === null || data === undefined) return undefined;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    const filtered = data
      .map(stripEmpty)
      .filter((v) => v !== undefined);
    return filtered.length > 0 ? filtered : undefined;
  }

  const obj = data as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    const cleaned = stripEmpty(v);
    if (cleaned !== undefined) result[k] = cleaned;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}
