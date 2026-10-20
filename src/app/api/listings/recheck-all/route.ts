import { NextResponse } from "next/server";
import { recheck } from "@/lib/ai/pipeline";
import { RULES_VERSION } from "@/lib/listing/compliance-rules";
import type { ListingResult } from "@/lib/listing/types";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { jsonError } from "@/lib/server/http";

export const runtime = "nodejs";

/** Free: re-checks every listing checked under an older rules version. */
export async function POST() {
  const user = await currentUser();
  if (!user) return jsonError(401, "unauthenticated", "Please sign in.");
  const db = supabaseAdmin();
  const { data: rows } = await db.from("listings").select("id,result,rules_version").eq("user_id", user.id).or(`rules_version.is.null,rules_version.lt.${RULES_VERSION}`).limit(500);
  let updated = 0;
  let raised = 0;
  for (const row of rows ?? []) {
    if (!row.result) continue;
    const before = (row.result as ListingResult).risk?.score ?? 0;
    const result = recheck(row.result as ListingResult);
    await db.from("listings").update({ result, risk_score: result.risk?.score ?? null, rules_version: RULES_VERSION, updated_at: new Date().toISOString() }).eq("id", row.id).eq("user_id", user.id);
    updated++;
    if ((result.risk?.score ?? 0) > before) raised++;
  }
  return NextResponse.json({ updated, raised });
}
