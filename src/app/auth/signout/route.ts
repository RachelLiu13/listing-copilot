import { NextResponse } from "next/server";
import { supabaseForUser } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseForUser();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
