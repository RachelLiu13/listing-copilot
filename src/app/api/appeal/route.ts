import { z } from "zod";
import { NextResponse } from "next/server";
import { draftAppeal } from "@/lib/ai/pipeline";
import { AIError, USER_MESSAGES } from "@/lib/ai/llm";
import type { ListingResult } from "@/lib/listing/types";
import { checkRateLimit, consumeCredit, ensureProfile, isActivePro, recordEvent, refundCredit, type ChargeResult } from "@/lib/account";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { getLLM } from "@/lib/server/llm";
import { jsonError, readJson } from "@/lib/server/http";
import { explainLanguageFor } from "@/lib/i18n/locales";
import { localeOf } from "@/lib/i18n/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  notice: z.string().trim().min(20, "Paste the full notice you received").max(8000),
  sellerNote: z.string().trim().max(2000).optional().default(""),
  listingId: z.string().uuid().optional(),
});

/** Explain a takedown or warning in the seller's language and draft the fix and appeal. One credit. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError(401, "unauthenticated", "Please sign in.");
  const body = Body.safeParse(await readJson(req));
  if (!body.success) return jsonError(400, "invalid_input", body.error.issues[0]?.message ?? "Invalid input");
  const limit = await checkRateLimit(user.id);
  if (!limit.ok) return jsonError(429, "rate_limited", limit.message);
  const profile = await ensureProfile(user.id, user.email ?? "");
  if (!isActivePro(profile) && profile.credits <= 0) return jsonError(402, "no_credits", "You have used your credits.");

  const db = supabaseAdmin();
  let listing: ListingResult | null = null;
  if (body.data.listingId) {
    const { data } = await db.from("listings").select("result").eq("id", body.data.listingId).eq("user_id", user.id).maybeSingle();
    listing = (data?.result as ListingResult) ?? null;
  }

  let charge: ChargeResult | null = null;
  await recordEvent(user.id, "appeal", "started");
  try {
    charge = await consumeCredit(user.id);
    if (charge === "no_credits") return jsonError(402, "no_credits", "You have used your credits.");
    const { appeal, usage } = await draftAppeal(body.data.notice, body.data.sellerNote, listing, getLLM(), explainLanguageFor(localeOf(req)));
    const { data, error } = await db.from("appeals").insert({ user_id: user.id, listing_id: body.data.listingId ?? null, notice: body.data.notice, result: appeal }).select("id").single();
    if (error) throw new Error(error.message);
    await recordEvent(user.id, "appeal", "complete", data.id, usage);
    return NextResponse.json({ id: data.id, appeal });
  } catch (err) {
    if (charge === "charged") await refundCredit(user.id);
    await recordEvent(user.id, "appeal", "failed", err instanceof Error ? err.message : String(err));
    return jsonError(502, "appeal_failed", err instanceof AIError ? USER_MESSAGES[err.kind] : "Could not draft the appeal. Please try again; you were not charged.", { ai: err instanceof AIError ? err.kind : undefined });
  }
}
