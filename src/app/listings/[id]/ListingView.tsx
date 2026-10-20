"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import RiskBadge from "@/components/RiskBadge";
import type { ListingCopy, ListingResult } from "@/lib/listing/types";
import { useLocale, useT } from "@/lib/i18n/client";
import { errorText } from "@/lib/i18n/errors";
import { LANGUAGE_NAMES, LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n/locales";

type Section = "title" | "bullets" | "description" | "searchTerms";
type Mark = { text: string; cls: string; tip: string };
interface Limits { label: string; titleMax: number; bulletMax: number; descriptionMax: number }

/** A language's English name ("Chinese", "Simplified Chinese") shown in the reader's language: 中文, tiếng Trung, chino… */
function languageLabel(name: string, reader: Locale): string {
  const l = LOCALES.find((x) => LANGUAGE_NAMES[x].toLowerCase().endsWith(name.toLowerCase()));
  if (!l) return name;
  try {
    return new Intl.DisplayNames([reader], { type: "language" }).of(l === "zh" ? "zh-Hans" : l) ?? LOCALE_LABELS[l];
  } catch {
    return LOCALE_LABELS[l];
  }
}

function sectionOf(field: string): Section {
  if (field.startsWith("bullets")) return "bullets";
  if (field === "search_terms" || field === "searchTerms") return "searchTerms";
  return field === "description" ? "description" : "title";
}

/** Wraps every flagged phrase in a <mark>; first match wins where phrases overlap. */
function Highlighted({ text, marks }: { text: string; marks: Mark[] }) {
  const lower = text.toLowerCase();
  const spans: { start: number; end: number; mark: Mark }[] = [];
  for (const m of marks) {
    if (!m.text) continue;
    let from = 0;
    const needle = m.text.toLowerCase();
    while (true) {
      const i = lower.indexOf(needle, from);
      if (i < 0) break;
      if (!spans.some((s) => i < s.end && i + needle.length > s.start)) spans.push({ start: i, end: i + needle.length, mark: m });
      from = i + needle.length;
    }
  }
  spans.sort((a, b) => a.start - b.start);
  const out: React.ReactNode[] = [];
  let pos = 0;
  spans.forEach((s, i) => {
    if (s.start > pos) out.push(text.slice(pos, s.start));
    out.push(<mark key={i} className={s.mark.cls} title={s.mark.tip}>{text.slice(s.start, s.end)}</mark>);
    pos = s.end;
  });
  out.push(text.slice(pos));
  return <>{out}</>;
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"
    >
      {done ? t.common.copied : (label ?? t.common.copy)}
    </button>
  );
}

export default function ListingView({ id, productName, initial, rewritesUsed, limits, rulesOutdated }: { id: string; productName: string; initial: ListingResult; rewritesUsed: number; limits: Limits; rulesOutdated: boolean }) {
  const T = useT();
  const t = T.listing;
  const locale = useLocale();
  const lang = (name: string) => languageLabel(name, locale);
  const SECTION_LABEL = t.sections;
  const [result, setResult] = useState(initial);
  const [outdated, setOutdated] = useState(rulesOutdated);
  const [rewritesLeft, setRewritesLeft] = useState(10 - rewritesUsed);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Section | null>(null);
  const [draft, setDraft] = useState("");
  const [requestFor, setRequestFor] = useState<Section | null>(null);
  const [request, setRequest] = useState("");
  const [nativeOn, setNativeOn] = useState(true);
  const [notice, setNotice] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const copy = result.copy;
  const native = result.native && !result.native.stale ? result.native : undefined;
  const showNative = Boolean(native && nativeOn);

  const marksFor = useMemo(() => {
    return (section: Section, index?: number): Mark[] => {
      const match = (field: string) => sectionOf(field) === section && (index === undefined || field === `bullets[${index}]`);
      return [
        ...result.compliance.filter((f) => match(f.field)).map((f) => ({ text: f.text, cls: f.severity === "high" ? "risk-high" : "risk-medium", tip: f.reason })),
        ...result.unsupportedClaims.filter((c) => match(c.field)).map((c) => ({ text: c.text, cls: "unconfirmed", tip: c.reason })),
      ];
    };
  }, [result]);

  async function post(url: string, body: unknown, what: string) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(errorText(T, json.error));
    setResult(json.result);
    if (typeof json.rewritesLeft === "number") setRewritesLeft(json.rewritesLeft);
    setNotice({ kind: "info", text: what });
    return json;
  }

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : T.common.somethingWrong });
    } finally {
      setBusy(null);
    }
  }

  const rewrite = (section: Section, req: string) =>
    run(section, async () => {
      await post(`/api/listings/${id}/rewrite`, { section, request: req }, t.rewritten(SECTION_LABEL[section]));
      setRequestFor(null);
      setRequest("");
    });

  function startEdit(section: Section) {
    setEditing(section);
    setDraft(section === "bullets" ? copy.bullets.join("\n") : section === "searchTerms" ? copy.searchTerms.join("\n") : copy[section]);
  }

  const saveEdit = (section: Section) =>
    run(section, async () => {
      const next: ListingCopy = { ...copy };
      if (section === "bullets") next.bullets = draft.split("\n").map((s) => s.trim()).filter(Boolean);
      else if (section === "searchTerms") next.searchTerms = draft.split("\n").map((s) => s.trim()).filter(Boolean);
      else next[section] = draft.trim();
      const res = await fetch(`/api/listings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ copy: next }) });
      const body = await res.json();
      if (!res.ok) throw new Error(errorText(T, body.error));
      setResult(body.result);
      setEditing(null);
      const issues = body.issues as { field: string; problem: string }[];
      setNotice(issues.length ? { kind: "error", text: t.savedBut(issues.map((i) => `${i.field} ${i.problem}`).join("; ")) } : { kind: "info", text: t.saved });
    });

  const high = result.compliance.filter((f) => f.severity === "high").length;
  const medium = result.compliance.length - high;
  // Rebuilt from the findings so the reasons read in the interface language (stored drivers are English).
  const drivers = [
    high > 0 && t.drivers.high(high),
    medium > 0 && t.drivers.medium(medium),
    result.unsupportedClaims.length > 0 && t.drivers.unconfirmed(result.unsupportedClaims.length),
    result.risk?.drivers.some((d) => d.startsWith("regulated")) && t.drivers.regulated((result.facts.category_pack ?? "").replace("_", " ")),
  ].filter((d): d is string => Boolean(d));
  const allText = [copy.title, "", ...copy.bullets.map((b) => `• ${b}`), "", copy.description, "", `Search terms: ${copy.searchTerms.join(" ")}`].join("\n");
  const tokens = result.usage.reduce((s, u) => ({ i: s.i + u.inputTokens, o: s.o + u.outputTokens }), { i: 0, o: 0 });
  const findingIndex = new Map(result.compliance.map((f, i) => [f, i]));

  const sectionTools = (section: Section) => (
    <div className="flex flex-wrap gap-2">
      <CopyButton value={section === "bullets" ? copy.bullets.join("\n") : section === "searchTerms" ? copy.searchTerms.join(" ") : copy[section]} />
      <button onClick={() => startEdit(section)} className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50">{T.common.edit}</button>
      <button disabled={busy !== null || rewritesLeft <= 0} onClick={() => setRequestFor(requestFor === section ? null : section)} className="rounded-md px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-300 hover:bg-indigo-50 disabled:opacity-50">
        {busy === section ? T.common.working : t.rewrite}
      </button>
    </div>
  );

  const sectionBody = (section: Section, view: React.ReactNode, meta?: string) => (
    <section className="rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900">{SECTION_LABEL[section]}{meta && <span className="ml-2 text-xs font-normal text-slate-500">{meta}</span>}</h2>
        {sectionTools(section)}
      </div>
      {requestFor === section && (
        <div className="mt-3 flex gap-2">
          <input value={request} onChange={(e) => setRequest(e.target.value)} maxLength={400} placeholder={t.requestPlaceholder} className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          <button onClick={() => rewrite(section, request)} disabled={busy !== null} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">{t.go}</button>
        </div>
      )}
      <div className="mt-3 text-[15px] leading-relaxed text-slate-800">
        {editing === section ? (
          <div>
            <textarea rows={section === "title" ? 3 : 8} value={draft} onChange={(e) => setDraft(e.target.value)} className="w-full rounded-lg border border-slate-300 p-3 text-sm" />
            {(section === "bullets" || section === "searchTerms") && <p className="text-xs text-slate-500">{t.onePerLine}</p>}
            <div className="mt-2 flex gap-2">
              <button onClick={() => saveEdit(section)} disabled={busy !== null} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white">{T.common.save}</button>
              <button onClick={() => setEditing(null)} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-300">{T.common.cancel}</button>
            </div>
          </div>
        ) : (
          view
        )}
      </div>
    </section>
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:underline">{t.back}</Link>
          <h1 className="mt-2 truncate text-2xl font-semibold text-slate-900">{productName}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {result.mode === "audit" && <span className="mr-2 rounded bg-slate-900 px-1.5 py-0.5 text-xs font-semibold text-white">{t.audit}</span>}
            {T.markets[result.platform] ?? limits.label} · {result.facts.category_pack ? `${t.rules(result.facts.category_pack.replace("_", " "))} · ` : ""}{t.rewritesLeft(rewritesLeft)}
          </p>
        </div>
        <div className="flex gap-2">
          <CopyButton value={allText} label={T.common.copyAll} />
          <a href={`/api/listings/${id}/export`} className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50">{T.common.exportCsv}</a>
        </div>
      </div>

      {outdated && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <span>{t.rulesUpdated}</span>
          <button disabled={busy !== null} onClick={() => run("recheck", async () => { await post(`/api/listings/${id}/recheck`, undefined, t.recheckDone); setOutdated(false); })} className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white disabled:opacity-60">
            {busy === "recheck" ? t.checking : t.recheck}
          </button>
        </div>
      )}
      {notice && <p className={`mt-4 rounded-lg p-3 text-sm ${notice.kind === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{notice.text}</p>}

      <div className="mt-6 grid gap-4 md:grid-cols-[auto_1fr]">
        {result.risk && (
          <div className="rounded-2xl border border-slate-200 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{T.risk.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {result.riskBefore && (
                <>
                  <RiskBadge score={result.riskBefore.score} level={result.riskBefore.level} labels={T.risk} />
                  <span className="text-slate-400">→</span>
                </>
              )}
              <RiskBadge score={result.risk.score} level={result.risk.level} labels={T.risk} size="lg" />
            </div>
            {drivers.length > 0 && <ul className="mt-3 space-y-1 text-xs text-slate-600">{drivers.map((d) => <li key={d}>• {d}</li>)}</ul>}
          </div>
        )}
        {result.native && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">{t.inLanguage(lang(result.native.language))}</p>
              {native && (
                <button onClick={() => setNativeOn(!nativeOn)} className="text-xs font-medium text-indigo-700 hover:underline">
                  {nativeOn ? t.showEnglish : t.showNative(lang(native.language))}
                </button>
              )}
            </div>
            {result.native.stale ? (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-indigo-900">
                <span>{t.stale}</span>
                <button disabled={busy !== null || rewritesLeft <= 0} onClick={() => run("explain", () => post(`/api/listings/${id}/explain`, undefined, t.refreshed))} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                  {busy === "explain" ? t.refreshing : t.refresh}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-indigo-950">{result.native.summary}</p>
            )}
          </div>
        )}
      </div>

      {result.mode === "audit" && result.original && (
        <details className="mt-4 rounded-2xl border border-slate-200 p-5 text-sm" open>
          <summary className="cursor-pointer font-semibold text-slate-900">{t.whatChanged}</summary>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">{t.before}</p>
              <p className="mt-1 font-medium"><Highlighted text={result.original.title} marks={(result.originalCompliance ?? []).filter((f) => f.field === "title").map((f) => ({ text: f.text, cls: f.severity === "high" ? "risk-high" : "risk-medium", tip: f.reason }))} /></p>
              <ul className="mt-2 space-y-1 text-slate-600">{result.original.bullets.map((b, i) => <li key={i}>• <Highlighted text={b} marks={(result.originalCompliance ?? []).filter((f) => f.field === `bullets[${i}]`).map((f) => ({ text: f.text, cls: f.severity === "high" ? "risk-high" : "risk-medium", tip: f.reason }))} /></li>)}</ul>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">{t.after}</p>
              <p className="mt-1 font-medium">{copy.title}</p>
              <ul className="mt-2 space-y-1 text-slate-600">{copy.bullets.map((b, i) => <li key={i}>• {b}</li>)}</ul>
            </div>
          </div>
        </details>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {sectionBody("title", <Highlighted text={copy.title} marks={marksFor("title")} />, t.chars(copy.title.length, limits.titleMax))}
          {sectionBody(
            "bullets",
            <ul className="space-y-2">
              {copy.bullets.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-slate-400">•</span>
                  <span><Highlighted text={b} marks={marksFor("bullets", i)} /><span className="ml-2 text-xs text-slate-400">{b.length}/{limits.bulletMax}</span></span>
                </li>
              ))}
            </ul>,
          )}
          {sectionBody("description", <p className="whitespace-pre-line"><Highlighted text={copy.description} marks={marksFor("description")} /></p>, t.chars(copy.description.length, limits.descriptionMax))}
          {sectionBody("searchTerms", <p className="font-mono text-sm"><Highlighted text={copy.searchTerms.join(" ")} marks={marksFor("searchTerms")} /></p>)}

          {native && (
            <details className="rounded-2xl border border-slate-200 p-5 text-sm">
              <summary className="cursor-pointer font-semibold text-slate-900">{t.readIn(lang(native.language))}</summary>
              <p className="mt-2 text-xs text-slate-500">{t.backNote}</p>
              <p className="mt-3 font-medium">{native.backTranslation.title}</p>
              <ul className="mt-2 space-y-1 text-slate-700">{native.backTranslation.bullets.map((b, i) => <li key={i}>• {b}</li>)}</ul>
              <p className="mt-2 whitespace-pre-line text-slate-700">{native.backTranslation.description}</p>
            </details>
          )}
        </div>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900">{t.compliance}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t.counts(high, medium, result.unsupportedClaims.length)}
            </p>
            {result.compliance.length === 0 && result.unsupportedClaims.length === 0 && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{t.clean}</p>}
            <ul className="mt-3 space-y-3">
              {result.compliance.map((f, i) => {
                const note = showNative ? native!.findingNotes[findingIndex.get(f) ?? i] : undefined;
                return (
                  <li key={i} className="rounded-lg bg-slate-50 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${f.severity === "high" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{f.severity === "high" ? T.risk.high1 : T.risk.medium1}</span>
                      <span className="text-xs text-slate-500">{f.field} · {f.source === "rule" ? t.rule : t.aiReview}</span>
                      {f.evidence && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">{t.backed}</span>}
                    </div>
                    <p className="mt-1 font-medium">“{f.text}”</p>
                    <p className="mt-1 text-slate-600">{note?.reason || f.reason}</p>
                    <p className="mt-1 text-slate-600"><span className="font-medium">→</span> {note?.suggestion || f.suggestion}</p>
                    <button disabled={busy !== null || rewritesLeft <= 0} onClick={() => rewrite(sectionOf(f.field), `Remove or reword "${f.text}" in ${f.field}: ${f.reason} ${f.suggestion}`)} className="mt-2 text-xs font-semibold text-indigo-700 hover:underline disabled:opacity-50">
                      {t.fix}
                    </button>
                  </li>
                );
              })}
              {result.unsupportedClaims.map((c, i) => (
                <li key={`u${i}`} className="rounded-lg bg-indigo-50 p-3 text-sm">
                  <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">{t.unconfirmed}</span>
                  <span className="ml-2 text-xs text-slate-500">{c.field}</span>
                  <p className="mt-1 font-medium">“{c.text}”</p>
                  <p className="mt-1 text-slate-600">{(showNative && native!.unsupportedNotes[i]) || c.reason}</p>
                  <button disabled={busy !== null || rewritesLeft <= 0} onClick={() => rewrite(sectionOf(c.field), `Remove "${c.text}": the seller did not state this.`)} className="mt-2 text-xs font-semibold text-indigo-700 hover:underline disabled:opacity-50">
                    {t.removeAi}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {result.imageCheck && (
            <div className="rounded-2xl border border-slate-200 p-5 text-sm">
              <h2 className="font-semibold text-slate-900">{t.image}</h2>
              {result.imageCheck.issues.length === 0 ? (
                <p className="mt-2 rounded-lg bg-emerald-50 p-3 text-emerald-800">{t.imageOk}</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {result.imageCheck.issues.map((iss, i) => (
                    <li key={i} className="rounded-lg bg-slate-50 p-3">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${iss.severity === "high" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{iss.severity === "high" ? T.risk.high1 : T.risk.medium1}</span>
                      <p className="mt-1">{iss.problem}</p>
                      <p className="mt-1 text-slate-600">→ {iss.fix}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {(result.fixesApplied.length > 0 || result.inputWarnings.length > 0) && (
            <div className="rounded-2xl border border-slate-200 p-5 text-sm">
              <h2 className="font-semibold text-slate-900">{t.autoFixes}</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">{[...result.fixesApplied, ...result.inputWarnings].map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          )}

          {result.mode !== "audit" && (
            <details className="rounded-2xl border border-slate-200 p-5 text-sm">
              <summary className="cursor-pointer font-semibold text-slate-900">{t.keywords}</summary>
              {result.keywordSignals && result.keywordSignals.length > 0 ? (
                <>
                  <p className="mt-2 text-xs text-slate-500">{t.signals}</p>
                  <div className="mt-1 flex flex-wrap gap-1">{result.keywordSignals.map((s) => <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{s}</span>)}</div>
                </>
              ) : (
                <p className="mt-2 text-xs text-slate-500">{t.estimates}</p>
              )}
              <ul className="mt-3 space-y-2">{result.keywords.primary.map((k) => <li key={k.phrase}><span className="font-medium">{k.phrase}</span><span className="block text-slate-500">{k.why}</span></li>)}</ul>
              {result.keywords.avoid.length > 0 && (
                <>
                  <p className="mt-3 font-medium text-slate-700">{t.avoided}</p>
                  <ul className="mt-1 space-y-1 text-slate-600">{result.keywords.avoid.map((k) => <li key={k.phrase}>“{k.phrase}”: {k.why}</li>)}</ul>
                </>
              )}
            </details>
          )}

          <details className="rounded-2xl border border-slate-200 p-5 text-sm">
            <summary className="cursor-pointer font-semibold text-slate-900">{t.facts}</summary>
            <dl className="mt-2 space-y-1 text-slate-600">
              <div><dt className="inline font-medium">{t.product}: </dt><dd className="inline">{result.facts.product_type_en}</dd></div>
              {result.facts.input_language && <div><dt className="inline font-medium">{t.writtenIn}: </dt><dd className="inline">{result.facts.input_language}</dd></div>}
              {result.facts.materials.length > 0 && <div><dt className="inline font-medium">{t.materials}: </dt><dd className="inline">{result.facts.materials.join(", ")}</dd></div>}
              {result.facts.dimensions.length > 0 && <div><dt className="inline font-medium">{t.size}: </dt><dd className="inline">{result.facts.dimensions.join(", ")}</dd></div>}
              {result.facts.key_features.length > 0 && <div><dt className="inline font-medium">{t.features}: </dt><dd className="inline">{result.facts.key_features.join("; ")}</dd></div>}
              {result.facts.stated_certifications.length > 0 && <div><dt className="inline font-medium">{t.claims}: </dt><dd className="inline">{result.facts.stated_certifications.join(", ")}</dd></div>}
              <div><dt className="inline font-medium">{t.documents}: </dt><dd className="inline">{result.evidence?.length ? result.evidence.join("; ") : t.noDocs}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-slate-400">{t.usage(result.usage.length, tokens.i.toLocaleString(), tokens.o.toLocaleString())}</p>
          </details>
        </aside>
      </div>
    </div>
  );
}
