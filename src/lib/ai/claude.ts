import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { AIError, type JsonRequest, type JsonResult, type LLM } from "./llm";

const MAX_ATTEMPTS = 2; // one retry when the answer is truncated or fails the schema

/** JSON Schema for structured outputs: draft 2020-12, no $schema key. */
export function toOutputSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-2020-12" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

export function createClaude(apiKey: string, model: string): LLM {
  // The SDK retries 408/409/429/5xx and connection errors itself (maxRetries).
  const client = new Anthropic({ apiKey, timeout: 90_000, maxRetries: 2 });

  return {
    async json<T>(req: JsonRequest<T>): Promise<JsonResult<T>> {
      const started = Date.now();
      const schema = toOutputSchema(req.schema);
      let maxTokens = req.maxTokens ?? 8000;
      let inputTokens = 0;
      let outputTokens = 0;
      let lastProblem = "";

      const content: Anthropic.Beta.BetaContentBlockParam[] = req.content.map((b) =>
        b.type === "text"
          ? { type: "text", text: b.text }
          : { type: "image", source: { type: "base64", media_type: b.mediaType, data: b.data } },
      );

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        let res: Anthropic.Beta.BetaMessage;
        try {
          res = await client.beta.messages.create({
            model,
            max_tokens: maxTokens,
            system: req.system,
            messages: [{ role: "user", content }],
            output_config: { effort: req.effort ?? "low", format: { type: "json_schema", schema } },
            // If a safety classifier declines, the API re-runs the request on
            // Anthropic's recommended fallback model instead of failing.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          });
        } catch (err) {
          throw toAIError(err, req.step);
        }

        inputTokens += res.usage.input_tokens;
        outputTokens += res.usage.output_tokens;

        if (res.stop_reason === "refusal") {
          throw new AIError("refusal", `Model declined at step ${req.step}`, req.step);
        }
        if (res.stop_reason === "max_tokens") {
          lastProblem = "answer was cut off at max_tokens";
          maxTokens *= 2;
          continue;
        }

        const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
        let raw: unknown;
        try {
          raw = JSON.parse(text);
        } catch {
          lastProblem = "answer was not valid JSON";
          continue;
        }
        const parsed = req.schema.safeParse(raw);
        if (!parsed.success) {
          lastProblem = `answer did not match the schema: ${parsed.error.issues[0]?.message ?? "unknown"}`;
          continue;
        }
        return { data: parsed.data, usage: { inputTokens, outputTokens, ms: Date.now() - started, attempts: attempt } };
      }
      throw new AIError("invalid_output", `Step ${req.step}: ${lastProblem}`, req.step);
    },
  };
}

function toAIError(err: unknown, step: string): AIError {
  // Most specific first; the SDK has already retried what is retryable.
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new AIError("config", `Claude API rejected the credentials (${err.status})`, step);
  }
  if (err instanceof Anthropic.NotFoundError || err instanceof Anthropic.BadRequestError) {
    return new AIError("config", `Claude API rejected the request (${err.status}): ${err.message}`, step);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new AIError("rate_limited", "Claude API rate limit", step);
  }
  if (err instanceof Anthropic.APIError) {
    return new AIError("unavailable", `Claude API error ${err.status ?? ""}: ${err.message}`, step);
  }
  return new AIError("unavailable", err instanceof Error ? err.message : String(err), step);
}
