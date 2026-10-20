import { ListingInputSchema } from "@/lib/listing/types";
import { complete, extract, NeedsMoreInfo, STEP_LABELS, type StepName } from "@/lib/ai/pipeline";
import { AIError, USER_MESSAGES } from "@/lib/ai/llm";
import { checkRateLimit, consumeCredit, ensureProfile, isActivePro, recordEvent, refundCredit, type ChargeResult } from "@/lib/account";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { getLLM } from "@/lib/server/llm";
import { jsonError, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Generate a listing. The response is a stream of newline-delimited JSON events
 * so the page can show each pipeline step as it runs:
 *   {type:"step", step, status, label, detail?}
 *   {type:"warning", message}
 *   {type:"needs_info", questions}   no credit spent
 *   {type:"no_credits"}              no credit spent
 *   {type:"error", message}          credit refunded if one was spent
 *   {type:"done", id}
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError(401, "unauthenticated", "Please sign in.");

  const parsed = ListingInputSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return jsonError(400, "invalid_input", parsed.error.issues[0]?.message ?? "Invalid input", { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
  }
  const input = parsed.data;

  const limit = await checkRateLimit(user.id);
  if (!limit.ok) return jsonError(429, "rate_limited", limit.message);

  const profile = await ensureProfile(user.id, user.email ?? "");
  // Cheap pre-check so a user with no credits does not trigger a model call.
  if (!isActivePro(profile) && profile.credits <= 0) return jsonError(402, "no_credits", "You have used your free listings.");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // The browser went away; keep working so a spent credit still yields a saved listing.
        }
      };
      const progress = (step: StepName, status: "running" | "done", detail?: string) => send({ type: "step", step, status, label: STEP_LABELS[step], detail });
      const llm = getLLM();
      let charge: ChargeResult | null = null;

      await recordEvent(user.id, "generate", "started");
      try {
        const ex = await extract(input, llm, progress);
        ex.inputWarnings.forEach((message) => send({ type: "warning", message }));

        charge = await consumeCredit(user.id);
        if (charge === "no_credits") {
          await recordEvent(user.id, "generate", "no_credits", undefined, ex.usage);
          send({ type: "no_credits" });
          return;
        }

        const result = await complete(input, ex, llm, progress);
        const { image: _image, ...storedInput } = input; // the photo is used once and not stored
        const { data, error } = await supabaseAdmin()
          .from("listings")
          .insert({ user_id: user.id, platform: input.platform, product_name: input.productName, input: { ...storedInput, hadImage: Boolean(_image) }, result })
          .select("id")
          .single();
        if (error || !data) throw new Error(`Saving the listing failed: ${error?.message}`);

        await recordEvent(user.id, "generate", "complete", data.id, result.usage);
        send({ type: "done", id: data.id });
      } catch (err) {
        if (err instanceof NeedsMoreInfo) {
          await recordEvent(user.id, "generate", "needs_info", err.questions.join(" | "));
          send({ type: "needs_info", questions: err.questions });
          return;
        }
        if (charge === "charged") await refundCredit(user.id);
        const message = err instanceof AIError ? USER_MESSAGES[err.kind] : "Something went wrong while writing your listing. Please try again; you were not charged.";
        console.error("generate failed", { user: user.id, step: err instanceof AIError ? err.step : undefined, error: err instanceof Error ? err.message : String(err) });
        await recordEvent(user.id, "generate", "failed", err instanceof Error ? err.message : String(err));
        send({ type: "error", message });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
