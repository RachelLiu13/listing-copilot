import { z } from "zod";
import { NextResponse } from "next/server";
import { PLATFORMS } from "@/lib/listing/platforms";
import { copyIssues } from "@/lib/listing/validate";
import { recheck } from "@/lib/ai/pipeline";
import type { ListingResult } from "@/lib/listing/types";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { jsonError, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

const EditSchema = z.object({
  copy: z.object({
    title: z.string().max(400),
    bullets: z.array(z.string().max(1000)).max(10),
    description: z.string().max(4000),
    searchTerms: z.array(z.string().max(200)).max(60),
  }),
});

/** Save the seller's manual edits. Re-runs the deterministic checks; no model call, no charge. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError(401, "unauthenticated", "Please sign in.");
  const { id } = await params;
  const parsed = EditSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, "invalid_input", parsed.error.issues[0]?.message ?? "Invalid edit");

  const db = supabaseAdmin();
  const { data: row } = await db.from("listings").select("id,result").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!row?.result) return jsonError(404, "not_found", "Listing not found.");

  const result = row.result as ListingResult;
  const copy = parsed.data.copy;
  const checked = recheck({ ...result, copy });
  // The seller's own words changed: the translation and explanation need a refresh.
  const updated: ListingResult = { ...checked, native: checked.native ? { ...checked.native, stale: true } : undefined };

  const { error } = await db.from("listings").update({ result: updated, risk_score: updated.risk?.score ?? null, rules_version: updated.rulesVersion, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
  if (error) return jsonError(500, "save_failed", "Could not save your changes. Please try again.");
  return NextResponse.json({ result: updated, issues: copyIssues(copy, PLATFORMS[result.platform]) });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError(401, "unauthenticated", "Please sign in.");
  const { id } = await params;
  const { error } = await supabaseAdmin().from("listings").delete().eq("id", id).eq("user_id", user.id);
  if (error) return jsonError(500, "delete_failed", "Could not delete the listing.");
  return NextResponse.json({ ok: true });
}
