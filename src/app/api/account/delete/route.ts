import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/account";
import { currentUser, supabaseAdmin, supabaseForUser } from "@/lib/supabase/server";
import { getStripe } from "@/lib/server/stripe";
import { jsonError, readJson } from "@/lib/server/http";

const Body = z.object({ confirmEmail: z.string() });

/**
 * Deletes the account: cancels any Stripe subscription first (so nobody is
 * billed for a deleted account), then the auth user. Listings, evidence,
 * appeals and usage go with it (on delete cascade); payment records are kept
 * without the user id, as accounting records.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError(401, "unauthenticated", "Please sign in first.");
  const body = Body.safeParse(await readJson(req));
  if (!body.success || body.data.confirmEmail.trim().toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return jsonError(400, "confirm_mismatch", "Type your email exactly to confirm.");
  }

  const profile = await getProfile(user.id);
  if (profile?.stripe_customer_id) {
    try {
      const stripe = getStripe();
      const subs = await stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: "all", limit: 20 });
      for (const s of subs.data) if (s.status !== "canceled" && s.status !== "incomplete_expired") await stripe.subscriptions.cancel(s.id);
    } catch (err) {
      console.error("cancel before delete failed", { user: user.id, error: err instanceof Error ? err.message : String(err) });
      return jsonError(502, "cancel_failed", "Could not cancel your subscription, so the account was not deleted. Please try again.");
    }
  }

  const { error } = await supabaseAdmin().auth.admin.deleteUser(user.id);
  if (error) {
    console.error("delete user failed", { user: user.id, error: error.message });
    return jsonError(500, "delete_failed", "Could not delete the account. Please try again.");
  }
  await (await supabaseForUser()).auth.signOut().catch(() => {});
  return NextResponse.json({ ok: true });
}
