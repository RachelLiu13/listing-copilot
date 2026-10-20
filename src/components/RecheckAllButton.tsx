"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

export default function RecheckAllButton({ count }: { count: number }) {
  const t = useT();
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
          setMessage(res.ok ? t.dashboard.recheckDone(body.updated, body.raised) : t.dashboard.recheckFailed);
          setBusy(false);
          router.refresh();
        }}
        className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white disabled:opacity-60"
      >
        {busy ? t.dashboard.rechecking : t.dashboard.recheckAll(count)}
      </button>
      {message && <span>{message}</span>}
    </div>
  );
}
