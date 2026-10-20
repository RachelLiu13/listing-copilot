import Link from "next/link";

const STEPS = [
  { n: "1", title: "Write in your own language", body: "Product name, selling points, material, size, in Chinese, Vietnamese, Spanish or any language. Add a photo if you like." },
  { n: "2", title: "Five AI steps run in order", body: "Facts are extracted, US search terms planned, copy written, limits checked and every claim reviewed." },
  { n: "3", title: "Review, fix, export", body: "Risky words are highlighted with the reason and a rewrite. Fix with one click, copy or export CSV." },
];

export default function Home() {
  return (
    <main>
      <section className="bg-gradient-to-b from-indigo-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:py-28">
          <p className="mx-auto inline-block rounded-full bg-white px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">For sellers worldwide on Amazon US and TikTok Shop US</p>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Listings that sound American, rank on real search terms and don&apos;t get taken down.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Write your product notes in any language. Machine translation gives you words; Listing Copilot gives you a localized US title, five bullets, a description and backend keywords, then checks every line for claims that get listings removed.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/login?mode=signup" className="rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-indigo-500">Write 3 listings free</Link>
            <Link href="/pricing" className="rounded-lg bg-white px-5 py-3 font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">See pricing</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-slate-200 p-6">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">{s.n}</span>
              <h3 className="mt-4 font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
