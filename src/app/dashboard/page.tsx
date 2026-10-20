import Link from "next/link";
import { redirect } from "next/navigation";
import BuyButton from "@/components/BuyButton";
import RiskBadge from "@/components/RiskBadge";
import RecheckAllButton from "@/components/RecheckAllButton";
import { RULES_VERSION } from "@/lib/listing/compliance-rules";
import { ensureProfile, isActivePro } from "@/lib/account";
import { isPlatform } from "@/lib/listing/platforms";
import type { ListingResult } from "@/lib/listing/types";
import { currentUser, supabaseForUser } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { DICTS } from "@/lib/i18n/dict";

export async function generateMetadata() {
  return { title: DICTS[await getLocale()].dashboard.metaTitle };
}
export const dynamic = "force-dynamic";

/** A file download from an API route, not a page, so a plain link (not next/link). */
const EXPORT_ALL = "/api/listings/export";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/dashboard");
  const { checkout } = await searchParams;
  const profile = await ensureProfile(user.id, user.email ?? "");
  const pro = isActivePro(profile);
  const locale = await getLocale();
  const T = DICTS[locale];
  const t = T.dashboard;
  const date = (d: string) => new Date(d).toLocaleDateString(locale);

  // Read through the user's own session: Row Level Security returns only their rows.
  const supabase = await supabaseForUser();
  const { data: listings } = await supabase.from("listings").select("id,platform,product_name,mode,result,risk_score,rules_version,created_at").order("created_at", { ascending: false }).limit(100);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {checkout === "success" && (
        <p className="mb-6 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{t.paid}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/listings/new" className="rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-500">{t.newListing}</Link>
          <Link href="/audit" className="rounded-lg px-4 py-2.5 font-medium ring-1 ring-slate-300 hover:bg-slate-50">{t.auditLive}</Link>
          <Link href="/bulk" className="rounded-lg px-4 py-2.5 font-medium ring-1 ring-slate-300 hover:bg-slate-50">{t.bulk}</Link>
          <Link href="/appeal" className="rounded-lg px-4 py-2.5 font-medium ring-1 ring-slate-300 hover:bg-slate-50">{t.takedown}</Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 p-5">
        <div className="flex-1">
          <p className="text-sm text-slate-500">{t.plan}</p>
          <p className="text-lg font-semibold">{pro ? t.pro : t.credits(profile.credits)}</p>
          {pro && profile.pro_until && <p className="text-xs text-slate-500">{t.activeUntil(date(profile.pro_until))}</p>}
        </div>
        {!pro && (
          <div className="flex w-full gap-3 sm:w-auto">
            <BuyButton offer="credit_pack" label={t.buyPack} />
            <BuyButton offer="pro_monthly" label={t.goPro} primary />
          </div>
        )}
      </div>

      {(() => {
        const outdated = (listings ?? []).filter((l) => (l.rules_version ?? 0) < RULES_VERSION).length;
        return outdated > 0 ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <span>{t.rulesUpdated(outdated)}</span>
            <RecheckAllButton count={outdated} />
          </div>
        ) : null;
      })()}

      {listings && listings.length > 1 && (
        <p className="mt-6 text-right text-sm"><a href={EXPORT_ALL} className="font-medium text-indigo-600 hover:underline">{t.exportAll}</a> · <Link href="/evidence" className="font-medium text-indigo-600 hover:underline">{t.evidenceLink}</Link></p>
      )}

      {!listings?.length ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <p className="text-slate-600">{t.empty}</p>
          <Link href="/listings/new" className="mt-4 inline-block text-sm font-semibold text-indigo-600 hover:underline">{t.firstListing}</Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200">
          {listings.map((l) => {
            const r = l.result as ListingResult | null;
            const high = r?.compliance.filter((f) => f.severity === "high").length ?? 0;
            const risk = r?.risk;
            return (
              <li key={l.id}>
                <Link href={`/listings/${l.id}`} className="flex items-center gap-4 p-4 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{r?.copy.title ?? l.product_name}</p>
                    <p className="mt-0.5 truncate text-sm text-slate-500">{l.mode === "audit" && <span className="mr-1 rounded bg-slate-900 px-1 py-0.5 text-[10px] font-semibold text-white">{t.audit}</span>}{l.product_name} · {isPlatform(l.platform) ? T.markets[l.platform] : l.platform} · {date(l.created_at)}</p>
                  </div>
                  {risk ? (
                    <RiskBadge score={risk.score} level={risk.level} labels={T.risk} />
                  ) : high > 0 ? (
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">{t.highRisks(high)}</span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">{t.noHighRisks}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
