import type Anthropic from "@anthropic-ai/sdk";

import type { KnowledgeBase } from "./knowledge.ts";

export const RESOLUTION_TYPES = [
  "how_to",
  "configuration",
  "frontend_change",
  "backend_change",
  "frontend_and_backend_change",
  "plugin_change",
  "data_or_permissions",
  "needs_more_info",
  "not_care_related",
] as const;

export type ResolutionType = (typeof RESOLUTION_TYPES)[number];

export interface ConfigChange {
  where: "frontend_env" | "backend_env" | "plugin_config" | "admin_ui";
  key: string;
  value: string;
  explanation: string;
}

export interface CodeChange {
  repo: string;
  file: string;
  change: string;
}

export interface AgentAnswer {
  spoken_summary: string;
  resolution_type: ResolutionType;
  details_markdown: string;
  config_changes: ConfigChange[];
  code_changes: CodeChange[];
  references: string[];
  follow_up_question: string;
}

export const SUBMIT_ANSWER = "submit_answer";

const stringProp = (description: string) => ({ type: "string", description });

export function toolDefinitions(
  sourceNames: string[],
): Anthropic.Beta.BetaTool[] {
  const source = {
    type: "string",
    enum: sourceNames,
    description: "Which checkout to look in.",
  };
  return [
    {
      name: "search_code",
      description:
        "Search the CARE source code (frontend, backend and plugins) line by line. " +
        "The query is a case-insensitive regular expression. Use it to find where an " +
        "error message, UI label, i18n key, API path, setting or component is defined. " +
        "UI text lives in care_fe public/locale/en.json: search the visible text there " +
        "first to get the i18n key, then search the key to find the component.",
      input_schema: {
        type: "object",
        properties: {
          query: stringProp("Regex or plain text to look for."),
          source: {
            ...source,
            description: "Optional: limit to one checkout.",
          },
          path_contains: stringProp(
            "Optional: only files whose path contains this text, e.g. 'src/components/Patient' or 'config/settings'.",
          ),
          max_results: {
            type: "integer",
            description: "Defaults to 40, at most 100.",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "read_file",
      description:
        "Read lines from a file in one of the checkouts. Returns at most 400 lines, numbered.",
      input_schema: {
        type: "object",
        properties: {
          source,
          path: stringProp("Path relative to the checkout root."),
          start_line: { type: "integer", description: "1-based, default 1." },
          end_line: { type: "integer", description: "Inclusive." },
        },
        required: ["source", "path"],
      },
    },
    {
      name: "list_dir",
      description: "List files and folders in a directory of one checkout.",
      input_schema: {
        type: "object",
        properties: {
          source,
          path: stringProp(
            "Directory relative to the checkout root, '' for the root.",
          ),
        },
        required: ["source", "path"],
      },
    },
    {
      name: SUBMIT_ANSWER,
      description:
        "Deliver the final answer to the user. Call this exactly once, when you are done " +
        "researching. The spoken_summary is read aloud, the rest is shown on screen.",
      strict: true,
      input_schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          spoken_summary: stringProp(
            "2 to 5 short sentences in the user's language, plain words, no markdown, no code, no file paths. This is spoken aloud.",
          ),
          resolution_type: {
            type: "string",
            enum: [...RESOLUTION_TYPES],
            description:
              "how_to: it already works, explain the steps. configuration: fixable with env vars, plugin config or admin settings, no code change. " +
              "frontend_change / backend_change / frontend_and_backend_change / plugin_change: needs a code change in that codebase. " +
              "data_or_permissions: fixable by creating data or granting roles/permissions in the app. needs_more_info: you need details to decide. " +
              "not_care_related: outside CARE.",
          },
          details_markdown: stringProp(
            "The full answer in markdown: steps, root cause, what to change and why.",
          ),
          config_changes: {
            type: "array",
            description: "Every setting to change. Empty if none.",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                where: {
                  type: "string",
                  enum: [
                    "frontend_env",
                    "backend_env",
                    "plugin_config",
                    "admin_ui",
                  ],
                },
                key: stringProp("Env var / setting name, or the admin screen."),
                value: stringProp("Value to set, or what to choose."),
                explanation: stringProp("Why this fixes it."),
              },
              required: ["where", "key", "value", "explanation"],
            },
          },
          code_changes: {
            type: "array",
            description:
              "Code changes needed when configuration is not enough. Empty if none.",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                repo: stringProp("care_fe, care, or the plugin name."),
                file: stringProp("Path of the file to change."),
                change: stringProp("What to change there."),
              },
              required: ["repo", "file", "change"],
            },
          },
          references: {
            type: "array",
            items: { type: "string" },
            description: "source:path:line locations you based the answer on.",
          },
          follow_up_question: stringProp(
            "A question for the user if you need more information, otherwise empty.",
          ),
        },
        required: [
          "spoken_summary",
          "resolution_type",
          "details_markdown",
          "config_changes",
          "code_changes",
          "references",
          "follow_up_question",
        ],
      },
    },
  ];
}

const asInt = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : fallback;

/** Runs a research tool. Throws on bad input; the caller reports it to the model. */
export function runTool(
  kb: KnowledgeBase,
  name: string,
  input: Record<string, unknown>,
): string {
  switch (name) {
    case "search_code": {
      if (typeof input.query !== "string" || !input.query) {
        throw new Error("query is required");
      }
      const results = kb.search(input.query, {
        source: typeof input.source === "string" ? input.source : undefined,
        pathContains:
          typeof input.path_contains === "string"
            ? input.path_contains
            : undefined,
        maxResults: Math.min(asInt(input.max_results, 40), 100),
      });
      return results.length ? results.join("\n") : "No matches.";
    }
    case "read_file": {
      if (typeof input.source !== "string" || typeof input.path !== "string") {
        throw new Error("source and path are required");
      }
      const file = kb.getFile(input.source, input.path);
      if (!file) {
        throw new Error(
          `${input.source}:${input.path} is not in the index. Use list_dir or search_code to find the right path.`,
        );
      }
      const start = Math.max(1, asInt(input.start_line, 1));
      const end = Math.min(
        file.lines.length,
        asInt(input.end_line, start + 399),
        start + 399,
      );
      const body = file.lines
        .slice(start - 1, end)
        .map((line, i) => `${start + i}\t${line}`)
        .join("\n");
      return `${file.source}:${file.path} lines ${start}-${end} of ${file.lines.length}\n${body}`;
    }
    case "list_dir": {
      if (typeof input.source !== "string")
        throw new Error("source is required");
      const entries = kb.listDir(input.source, String(input.path ?? ""));
      return entries.length
        ? entries.join("\n")
        : "Empty or unknown directory.";
    }
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}

/** Describes a research step in words, so the UI can show progress. */
export function describeToolCall(name: string, input: Record<string, unknown>) {
  switch (name) {
    case "search_code":
      return `Searching the code for "${String(input.query).slice(0, 60)}"`;
    case "read_file":
      return `Reading ${String(input.path)}`;
    case "list_dir":
      return `Looking in ${String(input.path) || String(input.source)}`;
    default:
      return "Preparing the answer";
  }
}

export function parseAnswer(input: unknown): AgentAnswer {
  const value = (input ?? {}) as Partial<AgentAnswer>;
  if (
    typeof value.spoken_summary !== "string" ||
    typeof value.details_markdown !== "string"
  ) {
    throw new Error("submit_answer needs spoken_summary and details_markdown");
  }
  return {
    spoken_summary: value.spoken_summary,
    resolution_type: RESOLUTION_TYPES.includes(
      value.resolution_type as ResolutionType,
    )
      ? (value.resolution_type as ResolutionType)
      : "needs_more_info",
    details_markdown: value.details_markdown,
    config_changes: Array.isArray(value.config_changes)
      ? value.config_changes
      : [],
    code_changes: Array.isArray(value.code_changes) ? value.code_changes : [],
    references: Array.isArray(value.references) ? value.references : [],
    follow_up_question:
      typeof value.follow_up_question === "string"
        ? value.follow_up_question
        : "",
  };
}
