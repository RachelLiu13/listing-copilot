import { AuditInputSchema } from "@/lib/listing/types";
import { audit, STEP_LABELS, type StepName } from "@/lib/ai/pipeline";
import { AIError, USER_MESSAGES } from "@/lib/ai/llm";
import { checkRateLimit, consumeCredit, ensureProfile, isActivePro, recordEvent, refundCredit, type ChargeResult } from "@/lib/account";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { getDeps } from "@/lib/server/llm";
import { jsonError, readJson } from "@/lib/server/http";
import { ndjson } from "@/lib/server/stream";
import { explainLanguageFor } from "@/lib/i18n/locales";
import { localeOf } from "@/lib/i18n/server";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Audit and fix a listing that is already live. One credit; refunded on failure. Streams progress like /api/listings. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError(401, "unauthenticated", "Please sign in.");
  const parsed = AuditInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, "invalid_input", parsed.error.issues[0]?.message ?? "Invalid input");
  const input = parsed.data;

  const limit = await checkRateLimit(user.id);
  if (!limit.ok) return jsonError(429, limit.code, limit.message);
  const profile = await ensureProfile(user.id, user.email ?? "");
  if (!isActivePro(profile) && profile.credits <= 0) return jsonError(402, "no_credits", "You have used your credits.");

  return ndjson(async (send) => {
    const progress = (step: StepName, status: "running" | "done", detail?: string) => send({ type: "step", step, status, label: STEP_LABELS[step], detail });
    let charge: ChargeResult | null = null;
    await recordEvent(user.id, "audit", "started");
    try {
      charge = await consumeCredit(user.id);
      if (charge === "no_credits") {
        send({ type: "no_credits" });
        return;
      }
      const result = await audit(input, { ...getDeps(), readerLanguage: explainLanguageFor(localeOf(req)) }, progress);
      const { data, error } = await supabaseAdmin()
        .from("listings")
        .insert({
          user_id: user.id,
          platform: input.platform,
          product_name: input.title.slice(0, 120),
          mode: "audit",
          input,
          result,
          risk_score: result.risk?.score ?? null,
          rules_version: result.rulesVersion,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`Saving the audit failed: ${error?.message}`);
      await recordEvent(user.id, "audit", "complete", data.id, result.usage);
      send({ type: "done", id: data.id });
    } catch (err) {
      if (charge === "charged") await refundCredit(user.id);
      console.error("audit failed", { user: user.id, error: err instanceof Error ? err.message : String(err) });
      await recordEvent(user.id, "audit", "failed", err instanceof Error ? err.message : String(err));
      send({ type: "error", code: err instanceof AIError ? `ai_${err.kind}` : "failed", message: err instanceof AIError ? USER_MESSAGES[err.kind] : "The audit failed. Please try again; you were not charged." });
    }
  });
}
