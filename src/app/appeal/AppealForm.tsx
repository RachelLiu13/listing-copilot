"use client";

import { useState } from "react";
import Link from "next/link";
import type { AppealResult } from "@/lib/listing/types";
import { useT } from "@/lib/i18n/client";
import { errorText } from "@/lib/i18n/errors";

export default function AppealForm({ listings }: { listings: { id: string; name: string }[] }) {
  const T = useT();
  const t = T.appeal;
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
      if (!res.ok) throw new Error(errorText(T, body.error));
      setResult(body.appeal);
    } catch (err) {
      setError(err instanceof Error ? err.message : T.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none";
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={submit} className="space-y-5 text-sm">
        <label className="block">
          <span className="font-medium text-slate-700">{t.notice}</span>
          <textarea required rows={9} maxLength={8000} value={notice} onChange={(e) => setNotice(e.target.value)} placeholder={t.noticePlaceholder} className={input} />
        </label>
        <label className="block">
          <span className="font-medium text-slate-700">{t.question}</span>
          <input maxLength={2000} value={sellerNote} onChange={(e) => setSellerNote(e.target.value)} placeholder={t.questionPlaceholder} className={input} />
          <span className="text-xs text-slate-500">{t.questionNote}</span>
        </label>
        {listings.length > 0 && (
          <label className="block">
            <span className="font-medium text-slate-700">{t.whichListing}</span>
            <select value={listingId} onChange={(e) => setListingId(e.target.value)} className={input}>
              <option value="">{t.notMine}</option>
              {listings.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
        )}
        <button disabled={busy} className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">{busy ? t.busy : t.submit}</button>
        {noCredits && <p className="rounded-lg bg-slate-50 p-3">{T.apiErrors.no_credits} <Link href="/pricing" className="font-semibold text-indigo-600">{T.common.seePlans}</Link></p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      </form>

      {result && (
        <div className="space-y-4 text-sm">
          <div className="rounded-2xl border border-slate-200 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{result.policy_area}</p>
            <p className="mt-2 font-semibold text-slate-900">{result.what_happened}</p>
            <p className="mt-2 text-slate-700"><span className="font-medium">{t.cause}</span>{result.likely_cause}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-5">
            <p className="font-semibold text-slate-900">{t.whatToDo}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">{result.fix_steps.map((s) => <li key={s}>{s}</li>)}</ol>
            {result.listing_changes.length > 0 && (
              <>
                <p className="mt-4 font-semibold text-slate-900">{t.changes}</p>
                <ul className="mt-1 space-y-1 text-slate-700">{result.listing_changes.map((c, i) => <li key={i}><span className="font-medium">{c.field}:</span> {c.change}</li>)}</ul>
              </>
            )}
            {result.documents_needed.length > 0 && (
              <>
                <p className="mt-4 font-semibold text-slate-900">{t.documents}</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">{result.documents_needed.map((d) => <li key={d}>{d}</li>)}</ul>
              </>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-900">{t.appealTitle}</p>
              <button onClick={async () => { await navigator.clipboard.writeText(result.appeal_text); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded-md px-2 py-1 text-xs font-medium ring-1 ring-slate-300">{copied ? T.common.copied : T.common.copy}</button>
            </div>
            <p className="mt-2 whitespace-pre-line text-slate-700">{result.appeal_text}</p>
            <p className="mt-3 text-xs text-slate-400">{t.appealNote}</p>
          </div>
        </div>
      )}
    </div>
  );
}
