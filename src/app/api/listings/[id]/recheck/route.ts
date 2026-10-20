import { NextResponse } from "next/server";
import { recheck } from "@/lib/ai/pipeline";
import type { ListingResult } from "@/lib/listing/types";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { jsonError } from "@/lib/server/http";

export const runtime = "nodejs";

/** Free: re-runs the rule layer under the current rules version. No model call. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError(401, "unauthenticated", "Please sign in.");
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: row } = await db.from("listings").select("id,result").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!row?.result) return jsonError(404, "not_found", "Listing not found.");
  const result = recheck(row.result as ListingResult);
  await db.from("listings").update({ result, risk_score: result.risk?.score ?? null, rules_version: result.rulesVersion, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ result });
}
