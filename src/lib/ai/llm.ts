import type { z } from "zod";

/** One content block of the user turn: text, or an image the seller uploaded. */
export type InputBlock =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string };

export type Effort = "low" | "medium" | "high";

export interface JsonRequest<T> {
  step: string;
  system: string;
  content: InputBlock[];
  schema: z.ZodType<T>;
  effort?: Effort;
  maxTokens?: number;
}

export interface JsonResult<T> {
  data: T;
  usage: { inputTokens: number; outputTokens: number; ms: number; attempts: number };
}

/**
 * The only thing the pipeline needs from a model: a schema-checked JSON answer.
 * Production uses Claude (claude.ts); tests pass a scripted fake.
 */
export interface LLM {
  json<T>(req: JsonRequest<T>): Promise<JsonResult<T>>;
}

export type AIErrorKind = "refusal" | "invalid_output" | "rate_limited" | "unavailable" | "config";

/** A failure the API route turns into a friendly message (and a credit refund). */
export class AIError extends Error {
  constructor(
    public kind: AIErrorKind,
    message: string,
    public step?: string,
  ) {
    super(message);
    this.name = "AIError";
  }
}

export const USER_MESSAGES: Record<AIErrorKind, string> = {
  refusal: "The AI declined to write this listing. Check the product details for anything a marketplace would not allow, then try again.",
  invalid_output: "The AI returned an incomplete answer twice. Please try again; you were not charged.",
  rate_limited: "The AI service is busy right now. Please wait a minute and try again; you were not charged.",
  unavailable: "The AI service did not respond. Please try again; you were not charged.",
  config: "The AI service is not configured correctly. The site owner has been notified.",
};
