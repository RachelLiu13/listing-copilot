import { NextResponse } from "next/server";
import { refreshExplanation } from "@/lib/ai/pipeline";
import { AIError, USER_MESSAGES } from "@/lib/ai/llm";
import type { ListingResult } from "@/lib/listing/types";
import { checkRateLimit, recordEvent } from "@/lib/account";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { getLLM } from "@/lib/server/llm";
import { jsonError } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_REWRITES = 10;

/** Refresh the review in the seller's language after edits. Counts as one AI rewrite. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError(401, "unauthenticated", "Please sign in.");
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: row } = await db.from("listings").select("id,result,rewrites").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!row?.result) return jsonError(404, "not_found", "Listing not found.");
  if (row.rewrites >= MAX_REWRITES) return jsonError(429, "rewrite_limit", `Each listing includes ${MAX_REWRITES} AI rewrites.`);
  const limit = await checkRateLimit(user.id);
  if (!limit.ok) return jsonError(429, "rate_limited", limit.message);

  await recordEvent(user.id, "explain", "started");
  try {
    const current = row.result as ListingResult;
    const { native, usage } = await refreshExplanation(current, getLLM());
    const result: ListingResult = { ...current, native, usage: [...current.usage, ...usage] };
    await db.from("listings").update({ result, rewrites: row.rewrites + 1, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
    await recordEvent(user.id, "explain", "complete", id, usage);
    return NextResponse.json({ result, rewritesLeft: MAX_REWRITES - row.rewrites - 1 });
  } catch (err) {
    await recordEvent(user.id, "explain", "failed", err instanceof Error ? err.message : String(err));
    return jsonError(502, "explain_failed", err instanceof AIError ? USER_MESSAGES[err.kind] : "Could not refresh the explanation. Please try again.");
  }
}
