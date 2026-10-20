import { z } from "zod";
import { NextResponse } from "next/server";
import { rewriteSection } from "@/lib/ai/pipeline";
import { AIError, USER_MESSAGES } from "@/lib/ai/llm";
import type { ListingResult } from "@/lib/listing/types";
import { checkRateLimit, recordEvent } from "@/lib/account";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { getLLM } from "@/lib/server/llm";
import { jsonError, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_REWRITES = 10; // per listing; rewrites are included in the listing's credit

const Body = z.object({
  section: z.enum(["title", "bullets", "description", "searchTerms"]),
  request: z.string().trim().max(400).optional().default(""),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError(401, "unauthenticated", "Please sign in.");
  const { id } = await params;
  const body = Body.safeParse(await readJson(req));
  if (!body.success) return jsonError(400, "invalid_input", body.error.issues[0]?.message ?? "Invalid request");

  const db = supabaseAdmin();
  const { data: row } = await db.from("listings").select("id,result,rewrites").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!row?.result) return jsonError(404, "not_found", "Listing not found.");
  if (row.rewrites >= MAX_REWRITES) return jsonError(429, "rewrite_limit", `Each listing includes ${MAX_REWRITES} AI rewrites. Edit the text directly, or create a new listing.`);

  const limit = await checkRateLimit(user.id);
  if (!limit.ok) return jsonError(429, limit.code, limit.message);

  await recordEvent(user.id, "rewrite", "started");
  try {
    const current = row.result as ListingResult;
    const out = await rewriteSection(body.data.section, current, body.data.request, getLLM());
    const result: ListingResult = out.result;
    const { error } = await db.from("listings").update({ result, risk_score: result.risk?.score ?? null, rules_version: result.rulesVersion, rewrites: row.rewrites + 1, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
    if (error) throw new Error(error.message);
    await recordEvent(user.id, "rewrite", "complete", `${id} ${body.data.section}`, out.usage);
    return NextResponse.json({ result, rewritesLeft: MAX_REWRITES - row.rewrites - 1 });
  } catch (err) {
    await recordEvent(user.id, "rewrite", "failed", err instanceof Error ? err.message : String(err));
    const message = err instanceof AIError ? USER_MESSAGES[err.kind] : "The rewrite failed. Please try again.";
    return jsonError(err instanceof AIError && err.kind === "rate_limited" ? 429 : 502, "rewrite_failed", message, { ai: err instanceof AIError ? err.kind : undefined });
  }
}
