"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import EvidencePicker from "@/components/EvidencePicker";
import Progress, { upsertStep, type StepState } from "@/components/Progress";
import { MARKETS, readNdjson, type MarketId } from "@/lib/client/ndjson";

export default function AuditForm() {
  const router = useRouter();
  const [platform, setPlatform] = useState<MarketId>("amazon_us");
  const [title, setTitle] = useState("");
  const [bullets, setBullets] = useState("");
  const [description, setDescription] = useState("");
  const [searchTerms, setSearchTerms] = useState("");
  const [productNotes, setProductNotes] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<StepState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [noCredits, setNoCredits] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSteps([]);
    setError(null);
    setNoCredits(false);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, title, bullets: bullets.split("\n").map((b) => b.replace(/^[•\-*\s]+/, "").trim()).filter(Boolean), description, searchTerms, productNotes, evidence }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        if (res.status === 402) return setNoCredits(true);
        throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
      }
      const finished = await readNdjson(res, (ev) => {
        switch (ev.type) {
          case "step":
            setSteps((p) => upsertStep(p, ev));
            return false;
          case "no_credits":
            setNoCredits(true);
            return true;
          case "error":
            setError(String(ev.message));
            return true;
          case "done":
            router.push(`/listings/${ev.id}`);
            return true;
        }
      });
      if (!finished) setError("The connection closed early. If the audit appears in My listings, it was saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none";
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <form onSubmit={submit} className="space-y-5 text-sm">
        <div>
          <p className="font-medium text-slate-700">Marketplace</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {MARKETS.map((m) => (
              <button type="button" key={m.id} onClick={() => setPlatform(m.id)} className={`rounded-lg px-3 py-2 font-medium ring-1 ${platform === m.id ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"}`}>{m.label}</button>
            ))}
          </div>
        </div>
        <label className="block"><span className="font-medium text-slate-700">Title</span><input required maxLength={500} value={title} onChange={(e) => setTitle(e.target.value)} className={input} /></label>
        <label className="block"><span className="font-medium text-slate-700">Bullet points (one per line)</span><textarea rows={6} value={bullets} onChange={(e) => setBullets(e.target.value)} className={input} /></label>
        <label className="block"><span className="font-medium text-slate-700">Description</span><textarea rows={5} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} className={input} /></label>
        <label className="block"><span className="font-medium text-slate-700">Backend search terms (optional)</span><input maxLength={1000} value={searchTerms} onChange={(e) => setSearchTerms(e.target.value)} className={input} /></label>
        <label className="block">
          <span className="font-medium text-slate-700">What the product really is (optional, any language)</span>
          <textarea rows={3} maxLength={3000} value={productNotes} onChange={(e) => setProductNotes(e.target.value)} placeholder="Material, size, what it does. With this we also flag claims the listing makes that are not true." className={input} />
        </label>
        <EvidencePicker value={evidence} onChange={setEvidence} />
        <button disabled={busy} className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">{busy ? "Auditing…" : "Audit and fix (1 credit)"}</button>
        <p className="text-center text-xs text-slate-500">If the audit fails, the credit is returned.</p>
      </form>
      <aside className="space-y-4">
        <Progress steps={steps} />
        {noCredits && <p className="rounded-lg bg-slate-50 p-3 text-sm">You have used your credits. <Link href="/pricing" className="font-semibold text-indigo-600">See plans →</Link></p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </aside>
    </div>
  );
}
