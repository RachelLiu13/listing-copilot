"use client";

import { useT } from "@/lib/i18n/client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const t = useT();
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-slate-900">{t.errors.title}</h1>
      <p className="mt-2 text-sm text-slate-600">{t.errors.body}</p>
      <button onClick={reset} className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{t.errors.retry}</button>
    </main>
  );
}
