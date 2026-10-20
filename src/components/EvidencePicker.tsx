"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";

type Item = { id: string; name: string; kind: string; reference: string };

/** Lets the seller tick which documents from their evidence library apply to this product. */
export default function EvidencePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const t = useT();
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    fetch("/api/evidence")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((b) => setItems(b.items ?? []))
      .catch(() => setItems([]));
  }, []);

  const label = (i: Item) => (i.reference ? `${i.name} (${i.reference})` : i.name);
  const toggle = (l: string) => onChange(value.includes(l) ? value.filter((v) => v !== l) : [...value, l]);

  return (
    <div className="text-sm">
      <span className="font-medium text-slate-700">{t.evidencePicker.label}</span>
      <p className="mt-0.5 text-xs text-slate-500">{t.evidencePicker.hint} <Link href="/evidence" className="text-indigo-600 hover:underline">{t.evidencePicker.manage}</Link></p>
      {items === null ? (
        <p className="mt-2 text-xs text-slate-400">{t.common.loading}</p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">{t.evidencePicker.none} <Link href="/evidence" className="text-indigo-600 hover:underline">{t.evidencePicker.library}</Link>.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((i) => {
            const l = label(i);
            const on = value.includes(l);
            return (
              <button type="button" key={i.id} onClick={() => toggle(l)} className={`rounded-full px-3 py-1 text-xs ring-1 ${on ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"}`}>
                {on ? "✓ " : ""}{l}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
