import { getLocale, getT } from "@/lib/i18n/server";
import type { LegalDoc } from "@/lib/legal/docs";

/** Legal documents are kept in English (the governing version); other interfaces show a note saying so. */
export default async function LegalPage({ doc }: { doc: LegalDoc }) {
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-sm leading-relaxed text-slate-700">
      {locale !== "en" && <p className="mb-6 rounded-lg bg-slate-50 p-3 text-slate-600" lang={locale}>{t.legal.englishOnly}</p>}
      <h1 className="text-2xl font-semibold text-slate-900">{doc.title}</h1>
      <p className="mt-1 text-xs text-slate-500">Last updated: {doc.updated}</p>
      {doc.sections.map((s) => (
        <section key={s.heading} className="mt-6">
          <h2 className="font-semibold text-slate-900">{s.heading}</h2>
          {s.body.map((p, i) => <p key={i} className="mt-2">{p}</p>)}
        </section>
      ))}
    </main>
  );
}
