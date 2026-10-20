import { z } from "zod";
import { NextResponse } from "next/server";
import { OFFERS } from "@/lib/billing";
import { ensureProfile, isActivePro } from "@/lib/account";
import { currentUser } from "@/lib/supabase/server";
import { getStripe } from "@/lib/server/stripe";
import { jsonError, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

const Body = z.object({ offer: z.enum(["credit_pack", "pro_monthly"]) });

/**
 * Starts a Stripe Checkout session (test mode in development).
 * Nothing is granted here: credits and Pro are applied only by the webhook,
 * after Stripe confirms payment with a signed event.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError(401, "unauthenticated", "Please sign in first.");
  const body = Body.safeParse(await readJson(req));
  if (!body.success) return jsonError(400, "invalid_input", "Unknown plan.");

  const profile = await ensureProfile(user.id, user.email ?? "");
  const offerId = body.data.offer;
  if (offerId === "pro_monthly" && isActivePro(profile)) {
    return jsonError(409, "already_pro", "You already have Pro.");
  }

  const offer = OFFERS[offerId];
  const origin = new URL(req.url).origin;
  const metadata = { user_id: user.id, offer: offerId };

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: offer.mode,
      client_reference_id: user.id,
      metadata,
      ...(profile.stripe_customer_id ? { customer: profile.stripe_customer_id } : { customer_email: user.email ?? undefined }),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: offer.amountCents,
            product_data: { name: `Listing Copilot: ${offer.name}` },
            ...(offer.mode === "subscription" ? { recurring: { interval: "month" as const } } : {}),
          },
        },
      ],
      ...(offer.mode === "subscription" ? { subscription_data: { metadata } } : {}),
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
    });
    if (!session.url) throw new Error("Stripe returned no checkout URL");
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("checkout failed", err instanceof Error ? err.message : err);
    return jsonError(502, "checkout_failed", "Could not open checkout. Please try again in a moment.");
  }
}
