import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export interface SourceRoot {
  /** Short name the agent uses to refer to this checkout, e.g. "care_fe". */
  name: string;
  /** What the checkout is, shown to the model. */
  description: string;
  root: string;
}

const bool = (value: string | undefined, fallback: boolean) =>
  value === undefined ? fallback : ["1", "true", "yes"].includes(value);

/**
 * Parses `CARE_EXTRA_SOURCES`, a comma separated list of `name=path` pairs,
 * e.g. `care_token_display=/srv/care_token_display,care_scribe=/srv/care_scribe`.
 */
function parseExtraSources(value: string | undefined): SourceRoot[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, root] = entry.split("=");
      if (!name || !root) {
        throw new Error(
          `Invalid CARE_EXTRA_SOURCES entry "${entry}", expected name=path`,
        );
      }
      return {
        name: name.trim(),
        description: `CARE plugin / app "${name.trim()}"`,
        root: path.resolve(root.trim()),
      };
    });
}

function buildSources(): SourceRoot[] {
  const sources: SourceRoot[] = [
    {
      name: "care_fe",
      description:
        "CARE frontend (React 19 + TypeScript + Vite). Runtime config comes from REACT_* env vars read in care.config.ts.",
      root: path.resolve(process.env.CARE_FE_DIR ?? path.join(here, "../..")),
    },
  ];
  if (process.env.CARE_BACKEND_DIR) {
    sources.push({
      name: "care",
      description:
        "CARE backend (Django + DRF). Settings come from env vars read in config/settings/*.py; plugins are configured in plug_config.py.",
      root: path.resolve(process.env.CARE_BACKEND_DIR),
    });
  }
  sources.push(...parseExtraSources(process.env.CARE_EXTRA_SOURCES));
  return sources;
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "0.0.0.0",
  model: process.env.VOICE_AGENT_MODEL ?? "claude-opus-5-5",
  effort: (process.env.VOICE_AGENT_EFFORT ?? "medium") as
    | "low"
    | "medium"
    | "high"
    | "xhigh"
    | "max",
  /** Upper bound on model round trips per question (each may run several tools). */
  maxIterations: Number(process.env.VOICE_AGENT_MAX_ITERATIONS ?? 25),
  /** CARE backend used to validate the caller's JWT. */
  careApiUrl: process.env.CARE_API_URL ?? "http://127.0.0.1:9000",
  requireAuth: bool(process.env.VOICE_AGENT_REQUIRE_AUTH, true),
  /** Comma separated list of origins allowed to call the agent (CORS). */
  allowedOrigins: (process.env.VOICE_AGENT_ALLOWED_ORIGINS ?? "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  /** Questions allowed per user per rate-limit window. */
  rateLimit: Number(process.env.VOICE_AGENT_RATE_LIMIT ?? 30),
  rateLimitWindowMs: 10 * 60 * 1000,
  sessionTtlMs: 60 * 60 * 1000,
  sources: buildSources(),
};
