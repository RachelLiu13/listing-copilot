import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getProfile } from "@/lib/account";
import { currentUser } from "@/lib/supabase/server";
import { getStripe } from "@/lib/server/stripe";
import { jsonError } from "@/lib/server/http";

let portalConfig: string | null = null;

/**
 * The portal needs a configuration. Use the account's default if one exists,
 * otherwise create one (cancel at period end, update card, invoices), so a
 * fresh Stripe account works without dashboard setup.
 */
async function configurationId(stripe: Stripe): Promise<string> {
  if (portalConfig) return portalConfig;
  const existing = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 });
  if (existing.data[0]) return (portalConfig = existing.data[0].id);
  const created = await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Listing Copilot: manage your subscription" },
    features: {
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
    },
  });
  return (portalConfig = created.id);
}

/** Opens Stripe's customer portal, where the seller can cancel Pro or update their card. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError(401, "unauthenticated", "Please sign in first.");
  const profile = await getProfile(user.id);
  if (!profile?.stripe_customer_id) return jsonError(404, "no_customer", "There is no subscription on this account.");
  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      configuration: await configurationId(stripe),
      return_url: `${new URL(req.url).origin}/account`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("billing portal failed", { user: user.id, error: err instanceof Error ? err.message : String(err) });
    return jsonError(502, "portal_failed", "Could not open the billing page. Please try again.");
  }
}
