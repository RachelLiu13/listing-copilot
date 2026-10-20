"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { errorText } from "@/lib/i18n/errors";

type Item = { id: string; name: string; kind: string; reference: string };
const KINDS = ["test_report", "certificate", "registration", "other"] as const;
const isKind = (k: string): k is (typeof KINDS)[number] => (KINDS as readonly string[]).includes(k);
const EXAMPLES = ["FDA 21 CFR 177.2600 food-contact test report", "LFGB test report", "EPA registration", "CPC (Children's Product Certificate)", "FCC ID", "USDA Organic certificate", "UL listing"];

export default function EvidenceManager() {
  const T = useT();
  const t = T.evidence;
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("test_report");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/evidence").then((r) => r.json()).then((b) => setItems(b.items ?? [])).catch(() => setError(t.loadFailed));
  }, [t.loadFailed]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/evidence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, kind, reference }) });
    const body = await res.json();
    if (!res.ok) return setError(body.error ? errorText(T, body.error) : t.saveFailed);
    setItems((i) => [body.item, ...i]);
    setName("");
    setReference("");
  }

  async function remove(id: string) {
    await fetch(`/api/evidence?id=${id}`, { method: "DELETE" });
    setItems((i) => i.filter((x) => x.id !== id));
  }

  const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none";
  return (
    <div className="grid gap-8 md:grid-cols-[1fr_1fr] text-sm">
      <form onSubmit={add} className="space-y-4 rounded-2xl border border-slate-200 p-5">
        <p className="font-semibold text-slate-900">{t.add}</p>
        <label className="block"><span className="font-medium text-slate-700">{t.what}</span><input required list="evidence-examples" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.whatPlaceholder} className={input} /></label>
        <datalist id="evidence-examples">{EXAMPLES.map((x) => <option key={x} value={x} />)}</datalist>
        <label className="block"><span className="font-medium text-slate-700">{t.type}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={input}>{KINDS.map((k) => <option key={k} value={k}>{t.kinds[k]}</option>)}</select>
        </label>
        <label className="block"><span className="font-medium text-slate-700">{t.reference}</span><input maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t.referencePlaceholder} className={input} /></label>
        <button className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-500">{T.common.save}</button>
        {error && <p className="text-red-600">{error}</p>}
        <p className="text-xs text-slate-500">{t.honest}</p>
      </form>
      <div>
        <p className="font-semibold text-slate-900">{t.yours}</p>
        {items.length === 0 ? (
          <p className="mt-3 text-slate-500">{t.none}</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 rounded-2xl border border-slate-200">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{i.name}</p>
                  <p className="text-xs text-slate-500">{isKind(i.kind) ? t.kinds[i.kind] : i.kind}{i.reference ? ` · ${i.reference}` : ""}</p>
                </div>
                <button onClick={() => remove(i.id)} className="text-xs text-slate-500 hover:text-red-600">{T.common.remove}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
