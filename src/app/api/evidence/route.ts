import { z } from "zod";
import { NextResponse } from "next/server";
import { currentUser, supabaseAdmin, supabaseForUser } from "@/lib/supabase/server";
import { jsonError, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

const EVIDENCE_KINDS = ["test_report", "certificate", "registration", "other"] as const;

const Body = z.object({
  name: z.string().trim().min(3, "Name the document").max(120),
  kind: z.enum(EVIDENCE_KINDS),
  reference: z.string().trim().max(120).optional().default(""),
});

/** The seller's evidence library: documents that let a claim stay in a listing. */
export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError(401, "unauthenticated", "Please sign in.");
  const supabase = await supabaseForUser();
  const { data } = await supabase.from("evidence").select("id,name,kind,reference,created_at").order("created_at", { ascending: false });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError(401, "unauthenticated", "Please sign in.");
  const body = Body.safeParse(await readJson(req));
  if (!body.success) return jsonError(400, "invalid_input", body.error.issues[0]?.message ?? "Invalid document");
  const db = supabaseAdmin();
  const { count } = await db.from("evidence").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if ((count ?? 0) >= 100) return jsonError(400, "too_many", "You can keep up to 100 documents.");
  const { data, error } = await db.from("evidence").insert({ user_id: user.id, ...body.data }).select("id,name,kind,reference,created_at").single();
  if (error) return jsonError(500, "save_failed", "Could not save the document.");
  return NextResponse.json({ item: data });
}

export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError(401, "unauthenticated", "Please sign in.");
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError(400, "invalid_input", "Unknown document.");
  await supabaseAdmin().from("evidence").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
