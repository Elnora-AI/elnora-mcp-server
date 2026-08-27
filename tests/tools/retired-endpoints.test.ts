import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

/**
 * Guard against half-finished endpoint migrations.
 *
 * ELN-880/881 retired the platform's `project` concept. The `elnora_projects_*`
 * tools and the folder paths were migrated to deprecated no-ops, but the legacy
 * `project` filters on `elnora_tasks_list` and `elnora_files_list` kept calling
 * `/projects/{id}/tasks` and `/projects/{id}/files` and returned NOT_FOUND to
 * every MCP caller that passed one.
 *
 * `projects-deprecated.test.ts` enumerates tools by name, so a caller nobody
 * thought to add to that list stays invisible. This reads the sources instead.
 */

const SRC_DIR = fileURLToPath(new URL("../../src", import.meta.url));

function collectTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectTsFiles(full, acc);
    else if (entry.endsWith(".ts")) acc.push(full);
  }
  return acc;
}

/** Strip line and block comments so prose about the retired routes doesn't trip the scan. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("retired /projects routes", () => {
  it("are not requested by any tool", () => {
    const offenders: string[] = [];
    for (const file of collectTsFiles(SRC_DIR)) {
      const code = stripComments(readFileSync(file, "utf-8"));
      // getClient().get(`/projects/…`) and any other verb, template or plain string.
      if (/\.(get|post|put|patch|del)\(\s*[`"']\/projects/.test(code)) {
        offenders.push(file.slice(SRC_DIR.length + 1));
      }
    }
    expect(offenders, `retired /projects routes are still called:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("are not reached through a path variable either", () => {
    const offenders: string[] = [];
    for (const file of collectTsFiles(SRC_DIR)) {
      const code = stripComments(readFileSync(file, "utf-8"));
      // e.g. `const path = project ? `/projects/${project}/tasks` : "/tasks"` — the
      // exact shape that hid the tasks.ts regression from the by-name guard.
      if (/[`"']\/projects\//.test(code)) offenders.push(file.slice(SRC_DIR.length + 1));
    }
    expect(offenders, `retired /projects paths still referenced:\n${offenders.join("\n")}`).toEqual([]);
  });
});
