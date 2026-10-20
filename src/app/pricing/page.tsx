import Link from "next/link";
import BuyButton from "@/components/BuyButton";
import { OFFERS } from "@/lib/billing";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getT()).pricing.metaTitle };
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  const { pricing: t } = await getT();
  const list = (items: string[]) => items.map((i) => <li key={i}>{i}</li>);
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-center text-3xl font-bold text-slate-900">{t.title}</h1>
      <p className="mt-3 text-center text-slate-600">{t.lead}</p>
      {checkout === "cancelled" && <p className="mx-auto mt-6 max-w-md rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-800">{t.cancelled}</p>}

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900">{t.free}</h2>
          <p className="mt-2 text-3xl font-bold">$0</p>
          <ul className="mt-6 space-y-2 text-sm text-slate-600">{list(t.freeItems)}</ul>
          <Link href="/login?mode=signup" className="mt-8 block rounded-lg px-4 py-2.5 text-center text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-50">{t.createAccount}</Link>
        </div>
        <div className="rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900">{t.pack}</h2>
          <p className="mt-2 text-3xl font-bold">{dollars(OFFERS.credit_pack.amountCents)}</p>
          <ul className="mt-6 space-y-2 text-sm text-slate-600">{list(t.packItems(OFFERS.credit_pack.credits))}</ul>
          <div className="mt-8"><BuyButton offer="credit_pack" label={t.buyPack(OFFERS.credit_pack.credits)} /></div>
        </div>
        <div className="rounded-2xl border-2 border-indigo-600 p-6">
          <h2 className="font-semibold text-indigo-700">{t.pro}</h2>
          <p className="mt-2 text-3xl font-bold">{dollars(OFFERS.pro_monthly.amountCents)}<span className="text-base font-normal text-slate-500">{t.perMonth}</span></p>
          <ul className="mt-6 space-y-2 text-sm text-slate-600">{list(t.proItems)}</ul>
          <div className="mt-8"><BuyButton offer="pro_monthly" label={t.goPro} primary /></div>
        </div>
      </div>
      <p className="mt-10 text-center text-xs text-slate-400">{t.testNote}</p>
    </main>
  );
}
