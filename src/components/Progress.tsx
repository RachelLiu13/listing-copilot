"use client";

import { useT } from "@/lib/i18n/client";

export type StepState = { step: string; label: string; status: "running" | "done"; detail?: string };

export default function Progress({ steps }: { steps: StepState[] }) {
  const t = useT();
  if (!steps.length) return null;
  const label = (s: StepState) => (s.step in t.steps ? t.steps[s.step as keyof typeof t.steps] : s.label);
  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <p className="text-sm font-semibold text-slate-900">{t.steps.progress}</p>
      <ol className="mt-3 space-y-3">
        {steps.map((s) => (
          <li key={s.step} className="flex gap-3 text-sm">
            <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full ${s.status === "done" ? "bg-emerald-500" : "animate-pulse bg-indigo-400"}`} />
            <span>
              <span className="text-slate-800">{label(s)}</span>
              {s.detail && <span className="block text-xs text-slate-500">{s.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function upsertStep(prev: StepState[], ev: Record<string, unknown>): StepState[] {
  const s = { step: String(ev.step), label: String(ev.label), status: ev.status as "running" | "done", detail: ev.detail as string | undefined };
  return [...prev.filter((p) => p.step !== s.step), s];
}
