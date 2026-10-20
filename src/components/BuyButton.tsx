"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OfferId } from "@/lib/billing";
import { useT } from "@/lib/i18n/client";

export default function BuyButton({ offer, label, primary = false }: { offer: OfferId; label: string; primary?: boolean }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offer }) });
      if (res.status === 401) {
        router.push(`/login?mode=signup&next=/pricing`);
        return;
      }
      const body = await res.json();
      if (!res.ok || !body.url) throw new Error(body.error?.message ?? t.pricing.checkoutFailed);
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t.pricing.checkoutFailed);
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={buy}
        disabled={busy}
        className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${primary ? "bg-indigo-600 text-white hover:bg-indigo-500" : "bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50"}`}
      >
        {busy ? t.pricing.opening : label}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
