import http from "node:http";

import Anthropic from "@anthropic-ai/sdk";

import { type AskInput, CareAgent, type Session } from "./agent.ts";
import { config } from "./config.ts";
import { KnowledgeBase } from "./knowledge.ts";

/**
 * HTTP API for the voice agent.
 *
 * POST /api/ask  {question, session_id?, error_text?, page?, language?}
 *   Requires `Authorization: Bearer <CARE access token>` unless
 *   VOICE_AGENT_REQUIRE_AUTH=false. Responds with newline-delimited JSON:
 *   {"type":"status","text":...}* then {"type":"answer","answer":{...}}
 *   or {"type":"error","message":...}.
 * POST /api/reset {session_id} forgets a conversation.
 * GET  /health
 */

const kb = new KnowledgeBase(config.sources);
const agent = new CareAgent(kb);
const sessions = new Map<string, Session>();
const usage = new Map<string, number[]>();
const authCache = new Map<string, { user: string; expires: number }>();

const MAX_BODY_BYTES = 64 * 1024;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function corsHeaders(origin: string | undefined): Record<string, string> {
  const allowAll = config.allowedOrigins.includes("*");
  if (!origin || (!allowAll && !config.allowedOrigins.includes(origin)))
    return {};
  return {
    "Access-Control-Allow-Origin": allowAll ? "*" : origin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    Vary: "Origin",
  };
}

async function readJson(
  req: http.IncomingMessage,
): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "Request too large");
    chunks.push(chunk);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // fall through
  }
  throw new HttpError(400, "Body must be a JSON object");
}

/** Resolves the CARE user behind the request's bearer token. */
async function authenticate(req: http.IncomingMessage): Promise<string> {
  if (!config.requireAuth) return "anonymous";
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    throw new HttpError(401, "Sign in to CARE first");
  const cached = authCache.get(header);
  if (cached && cached.expires > Date.now()) return cached.user;

  const res = await fetch(`${config.careApiUrl}/api/v1/users/getcurrentuser/`, {
    headers: { Authorization: header, Accept: "application/json" },
  }).catch(() => {
    throw new HttpError(
      502,
      "Could not reach the CARE backend to verify the session",
    );
  });
  if (!res.ok) throw new HttpError(401, "CARE session is invalid or expired");
  const user = (await res.json()) as { username?: string; id?: string };
  const id = user.username ?? user.id;
  if (!id) throw new HttpError(401, "CARE session is invalid");
  authCache.set(header, { user: id, expires: Date.now() + 5 * 60 * 1000 });
  return id;
}

function checkRateLimit(user: string) {
  const now = Date.now();
  const recent = (usage.get(user) ?? []).filter(
    (t) => now - t < config.rateLimitWindowMs,
  );
  if (recent.length >= config.rateLimit) {
    throw new HttpError(429, "Too many questions, please wait a few minutes");
  }
  recent.push(now);
  usage.set(user, recent);
}

function getSession(user: string, sessionId: string): Session {
  const now = Date.now();
  for (const [key, s] of sessions) {
    if (!s.busy && now - s.updatedAt > config.sessionTtlMs)
      sessions.delete(key);
  }
  const key = `${user}:${sessionId}`;
  let session = sessions.get(key);
  if (!session) {
    session = { messages: [], updatedAt: now, busy: false };
    sessions.set(key, session);
  }
  return session;
}

const optionalString = (value: unknown, max: number) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : undefined;

async function handleAsk(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  headers: Record<string, string>,
) {
  const user = await authenticate(req);
  const body = await readJson(req);
  const question = optionalString(body.question, 4000);
  if (!question) throw new HttpError(400, "question is required");
  const input: AskInput = {
    question,
    errorText: optionalString(body.error_text, 8000),
    page: optionalString(body.page, 300),
    language: optionalString(body.language, 20),
  };
  const session = getSession(
    user,
    optionalString(body.session_id, 100) ?? "default",
  );
  if (session.busy)
    throw new HttpError(409, "Still answering the previous question");
  checkRateLimit(user);

  session.busy = true;
  res.writeHead(200, {
    ...headers,
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Accel-Buffering": "no",
  });
  const send = (event: object) => res.write(`${JSON.stringify(event)}\n`);
  try {
    const answer = await agent.ask(session, input, (text) =>
      send({ type: "status", text }),
    );
    send({ type: "answer", answer });
  } catch (error) {
    console.error("[ask] failed", error);
    const message =
      error instanceof Anthropic.RateLimitError
        ? "The assistant is busy right now, please try again in a minute."
        : error instanceof Anthropic.APIConnectionError
          ? "The assistant could not reach its AI service."
          : "Something went wrong while answering.";
    send({ type: "error", message });
  } finally {
    session.busy = false;
    session.updatedAt = Date.now();
    res.end();
  }
}

const server = http.createServer(async (req, res) => {
  const headers = corsHeaders(req.headers.origin);
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, headers).end();
      return;
    }
    if (req.method === "GET" && url.pathname === "/health") {
      res
        .writeHead(200, { ...headers, "Content-Type": "application/json" })
        .end(
          JSON.stringify({
            status: "ok",
            sources: kb.sources.map((s) => s.name),
            files: kb.files.length,
          }),
        );
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/ask") {
      await handleAsk(req, res, headers);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/reset") {
      const user = await authenticate(req);
      const body = await readJson(req);
      sessions.delete(
        `${user}:${optionalString(body.session_id, 100) ?? "default"}`,
      );
      res.writeHead(204, headers).end();
      return;
    }
    throw new HttpError(404, "Not found");
  } catch (error) {
    if (res.headersSent) {
      res.end();
      return;
    }
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) console.error(error);
    res
      .writeHead(status, { ...headers, "Content-Type": "application/json" })
      .end(
        JSON.stringify({
          detail: error instanceof HttpError ? error.message : "Internal error",
        }),
      );
  }
});

server.listen(config.port, config.host, () => {
  console.log(
    `CARE voice agent listening on http://${config.host}:${config.port} (model ${config.model}, auth ${config.requireAuth ? "on" : "off"})`,
  );
});
