import readline from "node:readline/promises";

import { CareAgent, type Session } from "./agent.ts";
import { config } from "./config.ts";
import { KnowledgeBase } from "./knowledge.ts";

/** Ask the agent questions from the terminal: `npm run ask`. */
const kb = new KnowledgeBase(config.sources);
const agent = new CareAgent(kb);
const session: Session = { messages: [], updatedAt: Date.now(), busy: false };
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

for (;;) {
  const question = (
    await rl.question("\nAsk about CARE (empty to quit): ")
  ).trim();
  if (!question) break;
  const answer = await agent.ask(session, { question }, (status) =>
    console.log(`  … ${status}`),
  );
  console.log(`\n[${answer.resolution_type}] ${answer.spoken_summary}\n`);
  console.log(answer.details_markdown);
  for (const c of answer.config_changes) {
    console.log(
      `  config (${c.where}): ${c.key}=${c.value} — ${c.explanation}`,
    );
  }
  for (const c of answer.code_changes) {
    console.log(`  code (${c.repo}) ${c.file}: ${c.change}`);
  }
  if (answer.references.length)
    console.log(`  refs: ${answer.references.join(", ")}`);
}
rl.close();
