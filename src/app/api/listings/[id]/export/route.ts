import { listingCsv } from "@/lib/csv";
import type { ListingResult } from "@/lib/listing/types";
import { currentUser, supabaseAdmin } from "@/lib/supabase/server";
import { jsonError } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError(401, "unauthenticated", "Please sign in.");
  const { id } = await params;
  const { data: row } = await supabaseAdmin().from("listings").select("product_name,platform,result").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!row?.result) return jsonError(404, "not_found", "Listing not found.");
  const csv = listingCsv([{ productName: row.product_name, platform: row.platform, copy: (row.result as ListingResult).copy }]);
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="listing-${id.slice(0, 8)}.csv"` },
  });
}
