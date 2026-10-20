import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { paymentActionFor } from "@/lib/billing";

const event = (type: string, object: Record<string, unknown>) => ({ id: "evt_1", type, data: { object } }) as unknown as Stripe.Event;

describe("Stripe events", () => {
  it("adds 20 credits for a paid credit pack", () => {
    const a = paymentActionFor(event("checkout.session.completed", { id: "cs_1", payment_status: "paid", metadata: { user_id: "u1", offer: "credit_pack" }, amount_total: 499, currency: "usd", customer: "cus_1" }));
    expect(a).toMatchObject({ userId: "u1", addCredits: 20, setPlan: null, customerId: "cus_1" });
  });

  it("starts Pro for a subscription checkout", () => {
    const a = paymentActionFor(event("checkout.session.completed", { id: "cs_2", payment_status: "paid", metadata: { user_id: "u1", offer: "pro_monthly" }, subscription: "sub_1" }));
    expect(a).toMatchObject({ setPlan: "pro", addCredits: 0, subscriptionId: "sub_1" });
  });

  it("ignores unpaid sessions and sessions without our metadata", () => {
    expect(paymentActionFor(event("checkout.session.completed", { id: "cs", payment_status: "unpaid", metadata: { user_id: "u1", offer: "credit_pack" } }))).toBeNull();
    expect(paymentActionFor(event("checkout.session.completed", { id: "cs", payment_status: "paid", metadata: {} }))).toBeNull();
  });

  it("ends Pro when the subscription is deleted", () => {
    const a = paymentActionFor(event("customer.subscription.deleted", { id: "sub_1", status: "canceled", metadata: { user_id: "u1" }, customer: "cus_1" }));
    expect(a).toMatchObject({ setPlan: "free", proUntil: null });
  });

  it("keeps Pro until the period ends when cancellation is scheduled", () => {
    const end = Math.floor(Date.UTC(2030, 0, 1) / 1000);
    const a = paymentActionFor(event("customer.subscription.updated", { id: "sub_1", status: "active", cancel_at_period_end: true, metadata: { user_id: "u1" }, items: { data: [{ current_period_end: end }] } }));
    expect(a).toMatchObject({ setPlan: "pro", proUntil: "2030-01-01T00:00:00.000Z" });
  });

  it("reads cancel_at, which the customer portal sets on newer API versions", () => {
    const end = Math.floor(Date.UTC(2030, 5, 1) / 1000);
    const a = paymentActionFor(event("customer.subscription.updated", { id: "sub_1", status: "active", cancel_at: end, cancel_at_period_end: false, metadata: { user_id: "u1" }, items: { data: [{ current_period_end: end }] } }));
    expect(a).toMatchObject({ setPlan: "pro", proUntil: "2030-06-01T00:00:00.000Z" });
  });
});
