"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import EvidencePicker from "@/components/EvidencePicker";
import { csvRecords } from "@/lib/client/csv";
import { MARKETS, readNdjson, type MarketId } from "@/lib/client/ndjson";
import { useT } from "@/lib/i18n/client";
import { errorText } from "@/lib/i18n/errors";

type Row = { productName: string; brand: string; sellingPoints: string; material: string; dimensions: string; targetAudience: string; notes: string };
type Status = { state: "waiting" | "running" | "done" | "needs_info" | "error" | "skipped"; detail?: string; id?: string };

const MAX_ROWS = 50;

function toRows(text: string): Row[] {
  return csvRecords(text)
    .map((r) => ({
      productName: r.product_name ?? r.name ?? "",
      brand: r.brand ?? "",
      sellingPoints: r.selling_points ?? "",
      material: r.material ?? "",
      dimensions: r.size ?? r.dimensions ?? "",
      targetAudience: r.target_customers ?? "",
      notes: r.notes ?? "",
    }))
    .filter((r) => r.productName);
}

/**
 * Runs one listing at a time through the same endpoint as the single form, so
 * every row gets the same checks, credits and error handling. Stops when
 * credits run out; rows that need more information are marked, not charged.
 */
export default function BulkRunner() {
  const T = useT();
  const t = T.bulk;
  const [platform, setPlatform] = useState<MarketId>("amazon_us");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<Status[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const parsed = toRows(await file.text());
    if (!parsed.length) return setError(t.noRows);
    if (parsed.length > MAX_ROWS) setError(t.tooMany(MAX_ROWS));
    setRows(parsed.slice(0, MAX_ROWS));
    setStatus(parsed.slice(0, MAX_ROWS).map(() => ({ state: "waiting" })));
  }

  const setOne = (i: number, s: Status) => setStatus((prev) => prev.map((p, j) => (j === i ? s : p)));

  async function run() {
    setRunning(true);
    stop.current = false;
    for (let i = 0; i < rows.length; i++) {
      if (stop.current) break;
      if (status[i]?.state === "done") continue;
      setOne(i, { state: "running", detail: t.starting });
      try {
        const res = await fetch("/api/listings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform, evidence, ...rows[i] }) });
        if (res.status === 402) {
          setOne(i, { state: "error", detail: t.noCreditsRow });
          setError(t.outOfCredits);
          break;
        }
        if (res.status === 429) {
          const body = await res.clone().json().catch(() => null);
          if (body?.error?.code !== "rate_limited") {
            // Daily or monthly limit: waiting a minute will not help.
            setOne(i, { state: "error", detail: errorText(T, body?.error) });
            setError(errorText(T, body?.error));
            break;
          }
          setOne(i, { state: "waiting", detail: t.retrying });
          await new Promise((r) => setTimeout(r, 60_000));
          i--;
          continue;
        }
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => null);
          setOne(i, { state: "error", detail: errorText(T, body?.error) });
          continue;
        }
        let final: Status = { state: "error", detail: T.apiErrors.connection };
        await readNdjson(res, (ev) => {
          switch (ev.type) {
            case "step":
              setOne(i, { state: "running", detail: String(ev.step) in T.steps ? T.steps[ev.step as keyof typeof T.steps] : String(ev.label) });
              return false;
            case "needs_info":
              final = { state: "needs_info", detail: (ev.questions as string[]).join(" ") };
              return true;
            case "no_credits":
              final = { state: "error", detail: t.noCreditsRow };
              stop.current = true;
              return true;
            case "error":
              final = { state: "error", detail: errorText(T, ev) };
              return true;
            case "done":
              final = { state: "done", id: String(ev.id) };
              return true;
          }
        });
        setOne(i, final);
      } catch {
        setOne(i, { state: "error", detail: t.network });
      }
    }
    setRunning(false);
  }

  const doneIds = status.filter((s) => s.state === "done" && s.id).map((s) => s.id!);
  const badge: Record<Status["state"], string> = {
    waiting: "bg-slate-100 text-slate-600",
    running: "bg-indigo-100 text-indigo-700",
    done: "bg-emerald-100 text-emerald-700",
    needs_info: "bg-amber-100 text-amber-800",
    error: "bg-red-100 text-red-700",
    skipped: "bg-slate-100 text-slate-500",
  };

  return (
    <div className="space-y-6 text-sm">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-200 p-5">
          <p className="font-semibold text-slate-900">{t.step1}</p>
          <p className="text-slate-600">{t.step1Body} <a href="/bulk-template.csv" download className="font-medium text-indigo-600 hover:underline">{t.template}</a> {t.columns}</p>
          <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={running} />
          {rows.length > 0 && <p className="text-slate-600">{t.loaded(rows.length)}</p>}
        </div>
        <div className="space-y-4 rounded-2xl border border-slate-200 p-5">
          <p className="font-semibold text-slate-900">{t.step2}</p>
          <div className="flex flex-wrap gap-2">
            {MARKETS.map((m) => (
              <button type="button" key={m.id} disabled={running} onClick={() => setPlatform(m.id)} className={`rounded-lg px-3 py-1.5 font-medium ring-1 ${platform === m.id ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-300"}`}>{T.markets[m.id]}</button>
            ))}
          </div>
          <EvidencePicker value={evidence} onChange={setEvidence} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={run} disabled={running || !rows.length} className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50">{running ? t.running : status.some((s) => s.state === "done") ? t.runRemaining : t.run}</button>
        {running && <button onClick={() => (stop.current = true)} className="rounded-lg px-4 py-2.5 ring-1 ring-slate-300">{t.stop}</button>}
        {doneIds.length > 0 && <a href={`/api/listings/export?ids=${doneIds.join(",")}`} className="rounded-lg px-4 py-2.5 font-medium ring-1 ring-slate-300 hover:bg-slate-50">{t.download(doneIds.length)}</a>}
      </div>
      {error && <p className="rounded-lg bg-amber-50 p-3 text-amber-900">{error} <Link href="/pricing" className="font-semibold text-indigo-600">{T.common.pricing}</Link></p>}

      {rows.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200">
          {rows.map((r, i) => (
            <li key={i} className="flex flex-wrap items-center gap-3 p-3">
              <span className="w-6 text-right text-xs text-slate-400">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{r.productName}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge[status[i]?.state ?? "waiting"]}`}>{t.status[status[i]?.state ?? "waiting"]}</span>
              {status[i]?.detail && <span className="w-full truncate pl-9 text-xs text-slate-500 sm:w-auto sm:max-w-xs sm:pl-0">{status[i].detail}</span>}
              {status[i]?.id && <Link href={`/listings/${status[i].id}`} className="text-xs font-semibold text-indigo-600 hover:underline">{T.common.open}</Link>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
