import { NextResponse } from "next/server";
import { getProfile } from "@/lib/account";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { jsonError } from "@/lib/server/http";

/** Everything stored about the signed-in user, as one JSON file (data portability). */
export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError(401, "unauthenticated", "Please sign in first.");
  const db = supabaseAdmin();
  const mine = (table: string, columns = "*") => db.from(table).select(columns).eq("user_id", user.id).order("created_at", { ascending: true });
  const [profile, listings, evidence, appeals, events, payments] = await Promise.all([
    getProfile(user.id),
    mine("listings"),
    mine("evidence"),
    mine("appeals"),
    mine("generation_events", "kind,outcome,input_tokens,output_tokens,created_at"),
    mine("payments", "kind,amount,currency,created_at"),
  ]);
  const body = {
    exported_at: new Date().toISOString(),
    account: { email: user.email, created_at: user.created_at, plan: profile?.plan, credits: profile?.credits, pro_until: profile?.pro_until },
    listings: listings.data ?? [],
    evidence: evidence.data ?? [],
    appeals: appeals.data ?? [],
    usage: events.data ?? [],
    payments: payments.data ?? [],
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="listing-copilot-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
