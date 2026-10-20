import "server-only";
import { serverEnv } from "../env";
import { createClaude } from "../ai/claude";
import type { Deps } from "../ai/pipeline";
import type { LLM } from "../ai/llm";
import { fetchSuggestions } from "../listing/suggest";

let llm: LLM | null = null;
export function getLLM(): LLM {
  if (!llm) {
    const env = serverEnv();
    llm = createClaude(env.ANTHROPIC_API_KEY, env.CLAUDE_MODEL);
  }
  return llm;
}

export const getDeps = (): Deps => ({ llm: getLLM(), suggest: fetchSuggestions });
