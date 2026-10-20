import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness plus which services are configured (never the values). */
export function GET() {
  const has = (k: string) => Boolean(process.env[k]);
  return NextResponse.json({
    ok: true,
    configured: {
      supabase: has("NEXT_PUBLIC_SUPABASE_URL") && has("NEXT_PUBLIC_SUPABASE_ANON_KEY") && has("SUPABASE_SERVICE_ROLE_KEY"),
      claude: has("ANTHROPIC_API_KEY"),
      stripe: has("STRIPE_SECRET_KEY") && has("STRIPE_WEBHOOK_SECRET"),
    },
  });
}
