"use client";

import { useState } from "react";
import Link from "next/link";
import type { AppealResult } from "@/lib/listing/types";

export default function AppealForm({ listings }: { listings: { id: string; name: string }[] }) {
  const [notice, setNotice] = useState("");
  const [sellerNote, setSellerNote] = useState("");
  const [listingId, setListingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noCredits, setNoCredits] = useState(false);
  const [result, setResult] = useState<AppealResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNoCredits(false);
    try {
      const res = await fetch("/api/appeal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notice, sellerNote, listingId: listingId || undefined }) });
      const body = await res.json();
      if (res.status === 402) return setNoCredits(true);
      if (!res.ok) throw new Error(body.error?.message ?? "Something went wrong.");
      setResult(body.appeal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none";
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={submit} className="space-y-5 text-sm">
        <label className="block">
          <span className="font-medium text-slate-700">The notice you received</span>
          <textarea required rows={9} maxLength={8000} value={notice} onChange={(e) => setNotice(e.target.value)} placeholder="Paste the full email or Seller Central message, e.g. 'Your listing ... has been removed because it may be a pesticide...'" className={input} />
        </label>
        <label className="block">
          <span className="font-medium text-slate-700">Your question (optional, any language)</span>
          <input maxLength={2000} value={sellerNote} onChange={(e) => setSellerNote(e.target.value)} placeholder="为什么被下架？我该怎么办？" className={input} />
          <span className="text-xs text-slate-500">We answer in the language you write here.</span>
        </label>
        {listings.length > 0 && (
          <label className="block">
            <span className="font-medium text-slate-700">Which listing (optional)</span>
            <select value={listingId} onChange={(e) => setListingId(e.target.value)} className={input}>
              <option value="">Not one of mine here</option>
              {listings.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
        )}
        <button disabled={busy} className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">{busy ? "Reading the notice…" : "Explain and draft the fix (1 credit)"}</button>
        {noCredits && <p className="rounded-lg bg-slate-50 p-3">You have used your credits. <Link href="/pricing" className="font-semibold text-indigo-600">See plans →</Link></p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      </form>

      {result && (
        <div className="space-y-4 text-sm">
          <div className="rounded-2xl border border-slate-200 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{result.policy_area}</p>
            <p className="mt-2 font-semibold text-slate-900">{result.what_happened}</p>
            <p className="mt-2 text-slate-700"><span className="font-medium">Most likely cause: </span>{result.likely_cause}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-5">
            <p className="font-semibold text-slate-900">What to do</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">{result.fix_steps.map((s) => <li key={s}>{s}</li>)}</ol>
            {result.listing_changes.length > 0 && (
              <>
                <p className="mt-4 font-semibold text-slate-900">Listing changes</p>
                <ul className="mt-1 space-y-1 text-slate-700">{result.listing_changes.map((c, i) => <li key={i}><span className="font-medium">{c.field}:</span> {c.change}</li>)}</ul>
              </>
            )}
            {result.documents_needed.length > 0 && (
              <>
                <p className="mt-4 font-semibold text-slate-900">Documents that help</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">{result.documents_needed.map((d) => <li key={d}>{d}</li>)}</ul>
              </>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-900">Appeal / Plan of Action (English)</p>
              <button onClick={async () => { await navigator.clipboard.writeText(result.appeal_text); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded-md px-2 py-1 text-xs font-medium ring-1 ring-slate-300">{copied ? "Copied" : "Copy"}</button>
            </div>
            <p className="mt-2 whitespace-pre-line text-slate-700">{result.appeal_text}</p>
            <p className="mt-3 text-xs text-slate-400">Make the listing changes first, then send this. Review it: only claim what is true for your product.</p>
          </div>
        </div>
      )}
    </div>
  );
}
