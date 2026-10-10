import careConfig from "@careConfig";

import { getAuthorizationHeader } from "@/Utils/request/utils";

export type VoiceAgentResolution =
  | "how_to"
  | "configuration"
  | "frontend_change"
  | "backend_change"
  | "frontend_and_backend_change"
  | "plugin_change"
  | "data_or_permissions"
  | "needs_more_info"
  | "not_care_related";

export interface VoiceAgentConfigChange {
  where: "frontend_env" | "backend_env" | "plugin_config" | "admin_ui";
  key: string;
  value: string;
  explanation: string;
}

export interface VoiceAgentCodeChange {
  repo: string;
  file: string;
  change: string;
}

export interface VoiceAgentAnswer {
  spoken_summary: string;
  resolution_type: VoiceAgentResolution;
  details_markdown: string;
  config_changes: VoiceAgentConfigChange[];
  code_changes: VoiceAgentCodeChange[];
  references: string[];
  follow_up_question: string;
}

export interface VoiceAgentQuestion {
  sessionId: string;
  question: string;
  errorText?: string;
  page: string;
  language: string;
}

type VoiceAgentEvent =
  | { type: "status"; text: string }
  | { type: "answer"; answer: VoiceAgentAnswer }
  | { type: "error"; message: string };

const agentUrl = (path: string) =>
  `${careConfig.voiceAgentUrl.replace(/\/+$/, "")}${path}`;

function headers() {
  const result: Record<string, string> = { "Content-Type": "application/json" };
  const authorization = getAuthorizationHeader();
  if (authorization) result.Authorization = authorization;
  return result;
}

/**
 * Asks the voice agent a question. The agent streams newline-delimited JSON
 * progress events while it researches, followed by the answer.
 */
export async function askVoiceAgent(
  input: VoiceAgentQuestion,
  onStatus: (text: string) => void,
  signal?: AbortSignal,
): Promise<VoiceAgentAnswer> {
  const res = await fetch(agentUrl("/api/ask"), {
    method: "POST",
    headers: headers(),
    signal,
    body: JSON.stringify({
      session_id: input.sessionId,
      question: input.question,
      error_text: input.errorText,
      page: input.page,
      language: input.language,
    }),
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? res.statusText);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = done ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as VoiceAgentEvent;
      if (event.type === "status") onStatus(event.text);
      if (event.type === "answer") return event.answer;
      if (event.type === "error") throw new Error(event.message);
    }
    if (done) break;
  }
  throw new Error("The assistant closed the connection without answering");
}

export async function resetVoiceAgentSession(sessionId: string) {
  await fetch(agentUrl("/api/reset"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ session_id: sessionId }),
  }).catch(() => undefined);
}
