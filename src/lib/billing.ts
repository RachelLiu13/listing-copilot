import type Stripe from "stripe";

/**
 * What can be bought. Prices are defined here (inline price_data at checkout),
 * so a fresh Stripe test account works without creating products first.
 */
export const OFFERS = {
  credit_pack: { name: "20 listing credits", amountCents: 499, credits: 20, mode: "payment" as const },
  pro_monthly: { name: "Pro: unlimited listings", amountCents: 999, credits: 0, mode: "subscription" as const },
};
export type OfferId = keyof typeof OFFERS;
export const isOfferId = (v: unknown): v is OfferId => v === "credit_pack" || v === "pro_monthly";

export interface PaymentAction {
  eventId: string;
  userId: string;
  kind: string;
  sessionId: string | null;
  amount: number | null;
  currency: string | null;
  addCredits: number;
  setPlan: "free" | "pro" | null;
  proUntil: string | null;
  customerId: string | null;
  subscriptionId: string | null;
}

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

/**
 * Turns a verified Stripe event into what should change for the user.
 * Pure (no I/O) so it can be unit-tested; the webhook route applies the result
 * in one database transaction, once per event id.
 */
export function paymentActionFor(event: Stripe.Event): PaymentAction | null {
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object as Stripe.Checkout.Session;
    const userId = s.metadata?.user_id ?? s.client_reference_id;
    const offer = s.metadata?.offer;
    if (!userId || !isOfferId(offer)) return null;
    if (s.payment_status !== "paid" && s.payment_status !== "no_payment_required") return null;
    const base = { eventId: event.id, userId, kind: offer, sessionId: s.id, amount: s.amount_total, currency: s.currency, customerId: idOf(s.customer), subscriptionId: idOf(s.subscription) };
    if (offer === "credit_pack") return { ...base, addCredits: OFFERS.credit_pack.credits, setPlan: null, proUntil: null };
    // Subscription start: Pro until the subscription says otherwise (updated/deleted events).
    return { ...base, addCredits: 0, setPlan: "pro", proUntil: null };
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.user_id;
    if (!userId) return null;
    const active = event.type === "customer.subscription.updated" && (sub.status === "active" || sub.status === "trialing");
    // A subscription set to cancel stays Pro until its period ends.
    const periodEnd = sub.items?.data?.[0]?.current_period_end;
    const until = active && sub.cancel_at_period_end && periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
    return {
      eventId: event.id,
      userId,
      kind: event.type === "customer.subscription.deleted" ? "subscription_ended" : "subscription_updated",
      sessionId: null,
      amount: null,
      currency: null,
      addCredits: 0,
      setPlan: active ? "pro" : "free",
      proUntil: until,
      customerId: idOf(sub.customer),
      subscriptionId: sub.id,
    };
  }
  return null;
}
