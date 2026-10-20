"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RecheckAllButton({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch("/api/listings/recheck-all", { method: "POST" });
          const body = await res.json().catch(() => ({}));
          setMessage(res.ok ? `Re-checked ${body.updated} listing(s); ${body.raised} now show a higher risk.` : "Re-check failed. Please try again.");
          setBusy(false);
          router.refresh();
        }}
        className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Checking…" : `Re-check ${count} listing${count > 1 ? "s" : ""} (free)`}
      </button>
      {message && <span>{message}</span>}
    </div>
  );
}
