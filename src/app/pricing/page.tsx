import Link from "next/link";
import BuyButton from "@/components/BuyButton";
import { OFFERS } from "@/lib/billing";

export const metadata = { title: "Pricing · Listing Copilot" };

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-center text-3xl font-bold text-slate-900">Simple pricing</h1>
      <p className="mt-3 text-center text-slate-600">Start free. Pay only when Listing Copilot saves you time.</p>
      {checkout === "cancelled" && <p className="mx-auto mt-6 max-w-md rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-800">Checkout was cancelled. You were not charged.</p>}

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900">Free</h2>
          <p className="mt-2 text-3xl font-bold">$0</p>
          <ul className="mt-6 space-y-2 text-sm text-slate-600">
            <li>3 credits: listings, audits or appeals</li><li>Risk score and compliance check</li><li>Explanations in your language</li>
          </ul>
          <Link href="/login?mode=signup" className="mt-8 block rounded-lg px-4 py-2.5 text-center text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-50">Create account</Link>
        </div>
        <div className="rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900">Credit pack</h2>
          <p className="mt-2 text-3xl font-bold">{dollars(OFFERS.credit_pack.amountCents)}</p>
          <ul className="mt-6 space-y-2 text-sm text-slate-600">
            <li>{OFFERS.credit_pack.credits} credits</li><li>Use them for listings, audits, bulk rows or appeals</li><li>Credits never expire</li>
          </ul>
          <div className="mt-8"><BuyButton offer="credit_pack" label={`Buy ${OFFERS.credit_pack.credits} credits`} /></div>
        </div>
        <div className="rounded-2xl border-2 border-indigo-600 p-6">
          <h2 className="font-semibold text-indigo-700">Pro</h2>
          <p className="mt-2 text-3xl font-bold">{dollars(OFFERS.pro_monthly.amountCents)}<span className="text-base font-normal text-slate-500">/month</span></p>
          <ul className="mt-6 space-y-2 text-sm text-slate-600">
            <li>Unlimited listings, audits and appeals</li><li>All 5 marketplaces, bulk CSV</li><li>Cancel any time</li>
          </ul>
          <div className="mt-8"><BuyButton offer="pro_monthly" label="Go Pro" primary /></div>
        </div>
      </div>
      <p className="mt-10 text-center text-xs text-slate-400">Payments are processed by Stripe. This deployment runs in Stripe test mode: use card 4242 4242 4242 4242, any future date and any CVC.</p>
    </main>
  );
}
