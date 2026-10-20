import Link from "next/link";
import { getT } from "@/lib/i18n/server";

const TOOL_LINKS = { new: "/listings/new", audit: "/audit", bulk: "/bulk", appeal: "/appeal" } as const;

export default async function Home() {
  const { home: t } = await getT();
  return (
    <main>
      <section className="bg-gradient-to-b from-indigo-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:py-24">
          <p className="mx-auto inline-block rounded-full bg-white px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">{t.badge}</p>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">{t.title}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">{t.lead}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/login?mode=signup" className="rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-indigo-500">{t.ctaTry}</Link>
            <Link href="/audit" className="rounded-lg bg-white px-5 py-3 font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">{t.ctaAudit}</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 sm:grid-cols-2">
          {t.pillars.map((p) => (
            <div key={p.title} className="rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">{p.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="text-center text-2xl font-bold text-slate-900">{t.toolsTitle}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(TOOL_LINKS) as (keyof typeof TOOL_LINKS)[]).map((k) => (
            <Link key={k} href={TOOL_LINKS[k]} className="rounded-2xl border border-slate-200 p-5 hover:border-indigo-300 hover:bg-indigo-50/40">
              <p className="font-semibold text-slate-900">{t.tools[k].title} →</p>
              <p className="mt-1 text-sm text-slate-600">{t.tools[k].body}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
