import type { Dict } from "./dict";

type ApiError = { code?: unknown; ai?: unknown; message?: unknown } | null | undefined;

/**
 * An API error in the reader's language. Routes send a stable code (and, for
 * model failures, the AIError kind); the English message is the fallback.
 */
export function errorText(t: Dict, err: ApiError): string {
  const known = t.apiErrors as Record<string, string>;
  if (typeof err?.ai === "string" && known[`ai_${err.ai}`]) return known[`ai_${err.ai}`];
  if (typeof err?.code === "string" && known[err.code]) return known[err.code];
  return typeof err?.message === "string" ? err.message : t.apiErrors.failed;
}
