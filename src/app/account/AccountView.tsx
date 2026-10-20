"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import { errorText } from "@/lib/i18n/errors";

/** A file download from an API route, not a page, so a plain link. */
const EXPORT_URL = "/api/account/export";

export default function AccountView({ email, pro, proUntil, credits, hasBilling }: { email: string; pro: boolean; proUntil: string | null; credits: number; hasBilling: boolean }) {
  const T = useT();
  const t = T.account;
  const [busy, setBusy] = useState<"portal" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");

  async function openPortal() {
    setBusy("portal");
    setError(null);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.url) return (window.location.href = body.url);
    setError(body?.error ? errorText(T, body.error) : t.portalFailed);
    setBusy(null);
  }

  async function remove() {
    setBusy("delete");
    setError(null);
    const res = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmEmail: confirm }) });
    if (res.ok) return (window.location.href = "/");
    const body = await res.json().catch(() => null);
    setError(body?.error ? errorText(T, body.error) : t.deleteFailed);
    setBusy(null);
  }

  const card = "rounded-2xl border border-slate-200 p-5";
  const button = "rounded-lg px-4 py-2 text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-60";
  return (
    <div className="space-y-5 text-sm">
      <h1 className="text-2xl font-semibold text-slate-900">{t.title}</h1>
      {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}

      <section className={card}>
        <dl className="grid gap-2 sm:grid-cols-[120px_1fr]">
          <dt className="text-slate-500">{t.email}</dt>
          <dd className="font-medium text-slate-900">{email}</dd>
          <dt className="text-slate-500">{t.plan}</dt>
          <dd className="font-medium text-slate-900">{pro ? (proUntil ? t.proUntil(proUntil) : t.pro) : t.free(credits)}</dd>
        </dl>
        <p className="mt-3 text-xs text-slate-500">{t.fairUse}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {hasBilling && <button onClick={openPortal} disabled={busy !== null} className={button}>{busy === "portal" ? t.opening : t.manage}</button>}
          {!pro && <Link href="/pricing" className={button}>{t.buy}</Link>}
        </div>
        {hasBilling && <p className="mt-2 text-xs text-slate-500">{t.manageNote}</p>}
      </section>

      <section className={card}>
        <h2 className="font-semibold text-slate-900">{t.password}</h2>
        <Link href="/account/password" className={`mt-3 inline-block ${button}`}>{t.changePassword}</Link>
      </section>

      <section className={card}>
        <h2 className="font-semibold text-slate-900">{t.data}</h2>
        <p className="mt-1 text-slate-600">{t.exportNote}</p>
        <a href={EXPORT_URL} className={`mt-3 inline-block ${button}`}>{t.export}</a>
      </section>

      <section className="rounded-2xl border border-red-200 p-5">
        <h2 className="font-semibold text-red-700">{t.danger}</h2>
        <p className="mt-1 text-slate-600">{t.deleteNote}</p>
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={t.deleteConfirm(email)} className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-red-500 focus:outline-none" />
        <button
          onClick={remove}
          disabled={busy !== null || confirm.trim().toLowerCase() !== email.toLowerCase()}
          className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
        >
          {busy === "delete" ? t.deleting : t.deleteButton}
        </button>
      </section>
    </div>
  );
}
