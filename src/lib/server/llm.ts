import "server-only";
import { serverEnv } from "../env";
import { createClaude } from "../ai/claude";
import type { LLM } from "../ai/llm";

let llm: LLM | null = null;
export function getLLM(): LLM {
  if (!llm) {
    const env = serverEnv();
    llm = createClaude(env.ANTHROPIC_API_KEY, env.CLAUDE_MODEL);
  }
  return llm;
}
