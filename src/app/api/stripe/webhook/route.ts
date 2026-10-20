import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { paymentActionFor } from "@/lib/billing";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getStripe } from "@/lib/server/stripe";

export const runtime = "nodejs";

/**
 * Stripe webhook. The signature is verified against the raw body before
 * anything is trusted; each event is applied at most once (payments table keyed
 * by event id), so Stripe's retries are safe.
 */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, serverEnv().STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const action = paymentActionFor(event);
  if (!action) return NextResponse.json({ received: true, ignored: event.type });

  const { data: applied, error } = await supabaseAdmin().rpc("apply_payment", {
    p_event_id: action.eventId,
    p_user: action.userId,
    p_kind: action.kind,
    p_session_id: action.sessionId,
    p_amount: action.amount,
    p_currency: action.currency,
    p_add_credits: action.addCredits,
    p_set_plan: action.setPlan,
    p_pro_until: action.proUntil,
    p_customer_id: action.customerId,
    p_subscription_id: action.subscriptionId,
  });
  if (error) {
    // 500 makes Stripe retry later; the event id keeps the retry idempotent.
    console.error("apply_payment failed", { event: event.id, error: error.message });
    return NextResponse.json({ error: "could not apply" }, { status: 500 });
  }
  return NextResponse.json({ received: true, applied });
}
