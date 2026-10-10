import Anthropic from "@anthropic-ai/sdk";

import { config } from "./config.ts";
import type { KnowledgeBase } from "./knowledge.ts";
import {
  type AgentAnswer,
  SUBMIT_ANSWER,
  describeToolCall,
  parseAnswer,
  runTool,
  toolDefinitions,
} from "./tools.ts";

type MessageParam = Anthropic.Beta.BetaMessageParam;

const INSTRUCTIONS = `You are the CARE support assistant. CARE is an open source EMR and hospital management system (a Digital Public Good by Open Healthcare Network). People talk to you by voice from inside CARE: doctors, nurses, facility admins, deployment engineers and developers.

You can read the real CARE source code through tools: the frontend (care_fe), and when configured the Django backend (care) and plugins. The code is the source of truth. Do not guess how CARE behaves: look it up, and cite the files you used.

For every question:
1. Work out what the person is trying to do, or which error they hit. The page they are on is given in <context>; use it to find the screen's component.
2. Research: search for the error text, UI label or feature (UI text is in care_fe public/locale/en.json, search the visible text to find the i18n key, then search the key). Follow it to the component, the API call (src/types/**/*Api.ts) and, if the backend is available, the viewset, serializer, permission or setting that decides the behaviour.
3. Decide how it gets solved, in this order of preference:
   - how_to: it already works; give the exact steps in the UI (menu names as the user sees them).
   - data_or_permissions: missing data (e.g. no location, schedule, questionnaire, role) or the user lacks a role/permission; say what to create or grant and where.
   - configuration: an existing env var or setting changes the behaviour. Frontend settings are REACT_* env vars read in care.config.ts and need a rebuild/redeploy of the frontend; backend settings are env vars in config/settings; plugins are enabled in plug_config.py (backend) and REACT_ENABLED_APPS (frontend). Give the exact key and value.
   - frontend_change / backend_change / frontend_and_backend_change / plugin_change: only when no existing configuration covers it. Say which files to change and what to change.
   Only call something configurable if you found the setting in the code. If a setting does not exist, say that a code change is needed.
4. Call submit_answer once with your answer. Do not write the answer as plain text.

Keep research proportional: simple how-to questions usually need 2 to 5 tool calls. Never ask for or repeat passwords, tokens, API keys or patient data. If the person pastes an error that contains secrets or patient details, do not repeat them.

The spoken_summary is read aloud by a speech engine: write it in the user's language (given in <context>), conversational, short, no markdown, no file paths, no code. Put details, steps, settings and file paths in details_markdown, in the same language.`;

function buildSystem(kb: KnowledgeBase): Anthropic.Beta.BetaTextBlockParam[] {
  const sources = kb.sources
    .map((s) => `- ${s.name}: ${s.description}`)
    .join("\n");
  const configVars = kb
    .configCatalog()
    .map(
      (v) =>
        `${v.source} ${v.scope} ${v.name} @ ${v.locations.join(", ")} :: ${v.snippet}`,
    )
    .join("\n");
  const knowledge = `<sources>
${sources}
</sources>

<overview_docs>
${kb.overviewDocs()}
</overview_docs>

<config_catalog note="Every env var / setting the code reads. Format: source scope NAME @ file:line :: first line that reads it">
${configVars}
</config_catalog>

<route_catalog note="Frontend page routes and backend API routes">
${kb.routeCatalog().join("\n")}
</route_catalog>`;
  return [
    { type: "text", text: INSTRUCTIONS },
    // The knowledge snapshot is identical for every request, so it is cached.
    {
      type: "text",
      text: knowledge,
      cache_control: { type: "ephemeral", ttl: "1h" },
    },
  ];
}

export interface AskInput {
  question: string;
  /** Error text the user pasted, if any. */
  errorText?: string;
  /** Route the user is on, e.g. /facility/<id>/patients. */
  page?: string;
  /** BCP-47 language of the user, e.g. en, hi, ml. */
  language?: string;
}

export interface Session {
  messages: MessageParam[];
  updatedAt: number;
  busy: boolean;
}

function fallbackAnswer(
  text: string,
  type: AgentAnswer["resolution_type"],
): AgentAnswer {
  return {
    spoken_summary: text,
    resolution_type: type,
    details_markdown: text,
    config_changes: [],
    code_changes: [],
    references: [],
    follow_up_question: "",
  };
}

export class CareAgent {
  private client = new Anthropic();
  private system: Anthropic.Beta.BetaTextBlockParam[];
  private tools: Anthropic.Beta.BetaTool[];
  private kb: KnowledgeBase;

  constructor(kb: KnowledgeBase) {
    this.kb = kb;
    this.system = buildSystem(kb);
    this.tools = toolDefinitions(kb.sources.map((s) => s.name));
  }

  /**
   * Answers one question, continuing the session's conversation so follow-ups
   * ("and where do I set that?") work. History is only ever appended to.
   */
  async ask(
    session: Session,
    input: AskInput,
    onStatus: (text: string) => void = () => {},
  ): Promise<AgentAnswer> {
    const context = [
      `<context page="${input.page ?? "unknown"}" language="${input.language ?? "en"}" />`,
      input.errorText ? `<error_text>\n${input.errorText}\n</error_text>` : "",
      input.question,
    ]
      .filter(Boolean)
      .join("\n");
    session.messages.push({ role: "user", content: context });

    for (let iteration = 0; iteration < config.maxIterations; iteration++) {
      onStatus(iteration === 0 ? "Thinking" : "Thinking about what I found");
      let response: Anthropic.Beta.BetaMessage;
      try {
        response = await this.client.beta.messages.create({
          model: config.model,
          max_tokens: 16000,
          system: this.system,
          tools: this.tools,
          messages: session.messages,
          thinking: { type: "adaptive" },
          output_config: { effort: config.effort },
          // Caches the growing conversation between research steps.
          cache_control: { type: "ephemeral" },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        });
      } catch (error) {
        // Drop an unanswered question so a retry does not ask it twice.
        if (iteration === 0) session.messages.pop();
        throw error;
      }

      if (response.stop_reason === "refusal") {
        // A refused turn is not added to the history, so the session stays usable.
        if (iteration === 0) session.messages.pop();
        return fallbackAnswer(
          "Sorry, I can't help with that request.",
          "not_care_related",
        );
      }

      session.messages.push({ role: "assistant", content: response.content });

      const toolUses = response.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
      );
      if (toolUses.length === 0) {
        const text = response.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return fallbackAnswer(
          text || "Sorry, I could not find an answer to that.",
          "needs_more_info",
        );
      }

      let answer: AgentAnswer | undefined;
      const results: Anthropic.Beta.BetaContentBlockParam[] = [];
      for (const call of toolUses) {
        const input = (call.input ?? {}) as Record<string, unknown>;
        try {
          if (call.name === SUBMIT_ANSWER) {
            answer = parseAnswer(input);
            results.push({
              type: "tool_result",
              tool_use_id: call.id,
              content: "Delivered to the user.",
            });
            continue;
          }
          onStatus(describeToolCall(call.name, input));
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: runTool(this.kb, call.name, input),
          });
        } catch (error) {
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: error instanceof Error ? error.message : String(error),
            is_error: true,
          });
        }
      }
      if (!answer && iteration === config.maxIterations - 2) {
        results.push({
          type: "text",
          text: "Research budget reached. Call submit_answer now with what you know.",
        });
      }
      // Always close the tool calls, so the next question continues a valid history.
      session.messages.push({ role: "user", content: results });
      if (answer) return answer;
    }

    return fallbackAnswer(
      "I could not finish researching that. Please ask again with more details.",
      "needs_more_info",
    );
  }
}
