import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { SourceRoot } from "./config.ts";

/**
 * In-memory index of the CARE checkouts the agent can look at. This is the
 * agent's "memory" of CARE: the code itself is the source of truth, so the
 * answers stay correct as the code changes (restart the server to re-index).
 */

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".md",
  ".mdx",
  ".rst",
  ".txt",
  ".json",
  ".yml",
  ".yaml",
  ".toml",
  ".cfg",
  ".ini",
  ".html",
  ".css",
  ".sh",
  ".conf",
  ".example",
  ".sample",
]);
const TEXT_FILENAMES = new Set([
  "Dockerfile",
  "Makefile",
  "Procfile",
  ".env",
  ".env.example",
  ".env.sample",
  ".env.template",
]);
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
  ".mypy_cache",
  ".pytest_cache",
  "staticfiles",
]);
const MAX_FILE_BYTES = 512 * 1024;

export interface IndexedFile {
  source: string;
  /** Path relative to the source root, always with forward slashes. */
  path: string;
  lines: string[];
}

export interface ConfigVar {
  name: string;
  scope: "frontend" | "backend" | "plugin";
  source: string;
  /** `path:line` of each place the variable is read. */
  locations: string[];
  /** The first line that reads it, trimmed (shows defaults / parsing). */
  snippet: string;
}

function isIndexable(relPath: string): boolean {
  const parts = relPath.split("/");
  if (parts.some((p) => SKIP_DIRS.has(p))) return false;
  const base = parts[parts.length - 1];
  // Only English strings: other locales are managed in Crowdin and are noise here.
  if (/^src\/Locale\/|^public\/locale\/(?!en\.json$)/.test(relPath)) {
    return false;
  }
  if (/\/migrations\/\d{4}_/.test(relPath)) return false;
  if (/\.(min|lock)\./.test(base) || base === "package-lock.json") return false;
  // Never read local env overrides, they may contain secrets.
  if (/^\.env\./.test(base) && !TEXT_FILENAMES.has(base)) return false;
  return TEXT_FILENAMES.has(base) || TEXT_EXTENSIONS.has(path.extname(base));
}

function listFiles(root: string): string[] {
  try {
    // Prefer tracked files: skips build output and untracked local secrets.
    const out = execFileSync("git", ["-C", root, "ls-files", "-z"], {
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const files = out.toString("utf8").split("\0").filter(Boolean);
    if (files.length) return files;
  } catch {
    // Not a git checkout, fall back to walking the tree.
  }
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile()) files.push(path.relative(root, abs));
    }
  };
  walk(root);
  return files.map((f) => f.split(path.sep).join("/"));
}

export class KnowledgeBase {
  readonly sources: SourceRoot[];
  readonly files: IndexedFile[] = [];
  private byKey = new Map<string, IndexedFile>();

  constructor(sources: SourceRoot[]) {
    this.sources = sources.filter((s) => {
      if (fs.existsSync(s.root)) return true;
      console.warn(`[knowledge] skipping ${s.name}: ${s.root} does not exist`);
      return false;
    });
    for (const source of this.sources) {
      let count = 0;
      for (const rel of listFiles(source.root)) {
        if (!isIndexable(rel)) continue;
        const abs = path.join(source.root, rel);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(abs);
        } catch {
          continue;
        }
        if (!stat.isFile() || stat.size > MAX_FILE_BYTES) continue;
        const file: IndexedFile = {
          source: source.name,
          path: rel,
          lines: fs.readFileSync(abs, "utf8").split(/\r?\n/),
        };
        this.files.push(file);
        this.byKey.set(`${source.name}:${rel}`, file);
        count++;
      }
      console.log(`[knowledge] indexed ${count} files from ${source.name}`);
    }
  }

  getFile(source: string, relPath: string): IndexedFile | undefined {
    const normalized = path.posix.normalize(relPath.replace(/^\.?\/+/, ""));
    return this.byKey.get(`${source}:${normalized}`);
  }

  filesOf(source: string): IndexedFile[] {
    return this.files.filter((f) => f.source === source);
  }

  /**
   * Case-insensitive search across indexed files. The query is treated as a
   * regular expression, or as plain text if it is not a valid one.
   */
  search(
    query: string,
    opts: { source?: string; pathContains?: string; maxResults?: number } = {},
  ): string[] {
    let re: RegExp;
    try {
      re = new RegExp(query, "i");
    } catch {
      re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }
    const max = opts.maxResults ?? 40;
    const results: string[] = [];
    for (const file of this.files) {
      if (opts.source && file.source !== opts.source) continue;
      if (opts.pathContains && !file.path.includes(opts.pathContains)) continue;
      for (let i = 0; i < file.lines.length; i++) {
        if (!re.test(file.lines[i])) continue;
        const text = file.lines[i].trim().slice(0, 240);
        results.push(`${file.source}:${file.path}:${i + 1}: ${text}`);
        if (results.length >= max) return results;
      }
    }
    return results;
  }

  /** Directory listing from the index (only indexed files are shown). */
  listDir(source: string, dir: string): string[] {
    const prefix = dir.replace(/^\.?\/+|\/+$/g, "");
    const entries = new Set<string>();
    for (const file of this.filesOf(source)) {
      if (prefix && !file.path.startsWith(`${prefix}/`)) continue;
      const rest = prefix ? file.path.slice(prefix.length + 1) : file.path;
      const [head, ...tail] = rest.split("/");
      entries.add(tail.length ? `${head}/` : head);
    }
    return [...entries].sort();
  }

  /** Every environment variable / setting the code reads, with where. */
  configCatalog(): ConfigVar[] {
    const vars = new Map<string, ConfigVar>();
    const record = (
      name: string,
      scope: ConfigVar["scope"],
      file: IndexedFile,
      line: number,
    ) => {
      const key = `${file.source}:${name}`;
      const location = `${file.path}:${line + 1}`;
      const existing = vars.get(key);
      if (existing) {
        if (existing.locations.length < 5) existing.locations.push(location);
        return;
      }
      vars.set(key, {
        name,
        scope,
        source: file.source,
        locations: [location],
        snippet: file.lines[line].trim().slice(0, 200),
      });
    };

    for (const file of this.files) {
      if (file.source === "care_fe") {
        const relevant =
          file.path === "care.config.ts" ||
          file.path.startsWith("src/") ||
          file.path.startsWith("vite.config");
        if (!relevant || file.path.endsWith(".d.ts")) continue;
        file.lines.forEach((text, i) => {
          for (const m of text.matchAll(/\b(REACT_[A-Z0-9_]+)\b/g)) {
            record(m[1], "frontend", file, i);
          }
        });
        continue;
      }
      if (!file.path.endsWith(".py")) continue;
      const isBackend = file.source === "care";
      // In the backend only settings and plugin config define deploy options.
      if (
        isBackend &&
        !file.path.startsWith("config/") &&
        file.path !== "plug_config.py"
      ) {
        continue;
      }
      file.lines.forEach((text, i) => {
        for (const m of text.matchAll(
          /\benv(?:\.\w+)?\(\s*["']([A-Z][A-Z0-9_]+)["']|os\.(?:environ\.get|getenv)\(\s*["']([A-Z][A-Z0-9_]+)["']|os\.environ\[\s*["']([A-Z][A-Z0-9_]+)["']/g,
        )) {
          record(
            m[1] ?? m[2] ?? m[3],
            isBackend ? "backend" : "plugin",
            file,
            i,
          );
        }
        // Plugin settings.py files declare their PLUGIN_CONFIGS keys in dicts / lists.
        const pluginKey = text.match(/^\s*["']([A-Z][A-Z0-9_]{2,})["']\s*[:,]/);
        if (!isBackend && pluginKey && file.path.endsWith("settings.py")) {
          record(pluginKey[1], "plugin", file, i);
        }
      });
    }
    return [...vars.values()].sort((a, b) =>
      a.source === b.source
        ? a.name.localeCompare(b.name)
        : a.source.localeCompare(b.source),
    );
  }

  /** Frontend page routes and backend API routes, for orientation. */
  routeCatalog(): string[] {
    const lines: string[] = [];
    for (const file of this.files) {
      if (
        file.source === "care_fe" &&
        /^src\/(Routers|pages)\/.*[Rr]outes?\w*\.tsx?$/.test(file.path)
      ) {
        const routes = file.lines
          .map((l) => l.match(/^\s*"(\/[^"]*)"\s*:/)?.[1])
          .filter((r): r is string => Boolean(r));
        if (routes.length) {
          lines.push(`care_fe ${file.path}: ${routes.join(" | ")}`);
        }
      }
      if (
        file.source !== "care_fe" &&
        /api_router\.py$|urls\.py$/.test(file.path)
      ) {
        const routes = file.lines
          .map(
            (l) =>
              l.match(/register\(\s*r?["']([^"']+)["']/)?.[1] ??
              l.match(/\bpath\(\s*r?["']([^"']+)["']/)?.[1],
          )
          .filter((r): r is string => Boolean(r));
        if (routes.length) {
          lines.push(`${file.source} ${file.path}: ${routes.join(" | ")}`);
        }
      }
    }
    return lines;
  }

  /** Top of each source's README / CLAUDE.md, the human written overview. */
  overviewDocs(maxLines = 160): string {
    const docs: string[] = [];
    for (const source of this.sources) {
      for (const name of ["CLAUDE.md", "AGENTS.md", "README.md"]) {
        const file = this.getFile(source.name, name);
        if (!file) continue;
        docs.push(
          `<doc source="${source.name}" path="${name}">\n${file.lines
            .slice(0, maxLines)
            .join("\n")}\n</doc>`,
        );
        break;
      }
    }
    return docs.join("\n\n");
  }
}
