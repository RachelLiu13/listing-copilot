import { listingCsv } from "@/lib/csv";
import type { ListingResult } from "@/lib/listing/types";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { jsonError } from "@/lib/server/http";

export const runtime = "nodejs";

/** Several listings in one CSV: /api/listings/export?ids=a,b,c (or no ids for all). */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError(401, "unauthenticated", "Please sign in.");
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter((s) => /^[0-9a-f-]{36}$/i.test(s)).slice(0, 500);
  let query = supabaseAdmin().from("listings").select("product_name,platform,result,created_at").eq("user_id", user.id).order("created_at", { ascending: true }).limit(500);
  if (ids.length) query = query.in("id", ids);
  const { data: rows } = await query;
  const csv = listingCsv((rows ?? []).filter((r) => r.result).map((r) => ({ productName: r.product_name, platform: r.platform, copy: (r.result as ListingResult).copy })));
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="listings-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
