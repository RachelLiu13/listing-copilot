import Link from "next/link";

const PILLARS = [
  {
    title: "Write in your language",
    body: "Notes in Chinese, Vietnamese, Spanish or any language become a listing for Amazon US, UK, DE, JP or TikTok Shop, in the marketplace's own language.",
  },
  {
    title: "Know your takedown risk before you publish",
    body: "Every listing gets a 0-100 risk score from category rule packs (cosmetics, supplements, kids, electronics, cleaning, pet) plus an AI review of implied claims.",
  },
  {
    title: "Understand every warning",
    body: "Why a phrase is risky and what to write instead, explained in your own language, with a back-translation of exactly what the listing claims.",
  },
  {
    title: "Keep claims you can prove",
    body: "Add your test reports and certificates once. Claims they cover can stay; claims without proof are rewritten. Nothing is invented: unconfirmed details are flagged.",
  },
];

const TOOLS = [
  { href: "/listings/new", title: "New listing", body: "From product notes (and a photo, with a main-image check)." },
  { href: "/audit", title: "Audit a live listing", body: "Risk score before and after, with the smallest fix." },
  { href: "/bulk", title: "Bulk CSV", body: "Up to 50 products at once, one CSV back." },
  { href: "/appeal", title: "Takedown help", body: "Paste the notice: cause, fixes and an appeal draft." },
];

export default function Home() {
  return (
    <main>
      <section className="bg-gradient-to-b from-indigo-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:py-24">
          <p className="mx-auto inline-block rounded-full bg-white px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">For cross-border sellers who don&apos;t write English natively</p>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">The compliance gatekeeper for your listings.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            AI can write a listing anywhere. Listing Copilot writes it in the marketplace&apos;s language, then catches the claims that get listings removed, and explains them in yours, before you publish.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/login?mode=signup" className="rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-indigo-500">Try 3 listings free</Link>
            <Link href="/audit" className="rounded-lg bg-white px-5 py-3 font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">Audit a live listing</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 sm:grid-cols-2">
          {PILLARS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">{p.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="text-center text-2xl font-bold text-slate-900">Everything a small seller needs to stay listed</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map((t) => (
            <Link key={t.href} href={t.href} className="rounded-2xl border border-slate-200 p-5 hover:border-indigo-300 hover:bg-indigo-50/40">
              <p className="font-semibold text-slate-900">{t.title} →</p>
              <p className="mt-1 text-sm text-slate-600">{t.body}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
