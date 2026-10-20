"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import EvidencePicker from "@/components/EvidencePicker";
import Progress, { upsertStep, type StepState } from "@/components/Progress";
import { MARKETS, readNdjson, type MarketId } from "@/lib/client/ndjson";
import { useT } from "@/lib/i18n/client";
import type { Dict } from "@/lib/i18n/dict";
import { errorText } from "@/lib/i18n/errors";

type Image = { mediaType: "image/jpeg"; data: string; preview: string; borderWhite: number };

type FieldKey = keyof Dict["newListing"]["fields"];
const FIELDS: { key: FieldKey; rows?: number; required?: boolean }[] = [
  { key: "productName", required: true },
  { key: "brand" },
  { key: "sellingPoints", rows: 4 },
  { key: "material" },
  { key: "dimensions" },
  { key: "targetAudience" },
  { key: "notes", rows: 3 },
];

/**
 * Resize in the browser (≤1024px JPEG) so uploads stay small, and measure how
 * white the photo's border is: the main image needs a pure white background.
 */
async function prepareImage(file: File): Promise<Image> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const { width: w, height: h } = canvas;
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.02));
  let white = 0;
  let total = 0;
  for (const [x, y, bw, bh] of [[0, 0, w, band], [0, h - band, w, band], [0, 0, band, h], [w - band, 0, band, h]]) {
    const px = ctx.getImageData(x, y, bw, bh).data;
    for (let i = 0; i < px.length; i += 16) {
      total++;
      if (px[i] >= 245 && px[i + 1] >= 245 && px[i + 2] >= 245) white++;
    }
  }
  const preview = canvas.toDataURL("image/jpeg", 0.85);
  return { mediaType: "image/jpeg", data: preview.split(",")[1], preview, borderWhite: total ? white / total : 0 };
}

export default function NewListingForm() {
  const T = useT();
  const t = T.newListing;
  const router = useRouter();
  const [platform, setPlatform] = useState<MarketId>("amazon_us");
  const [values, setValues] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState<string[]>([]);
  const [image, setImage] = useState<Image | null>(null);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<StepState[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState("");
  const [noCredits, setNoCredits] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef<HTMLElement>(null);
  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));

  // On narrow screens the status panel sits below the form: bring it into view when something happens.
  const hasStatus = steps.length > 0 || Boolean(questions) || noCredits || Boolean(error);
  useEffect(() => {
    if (hasStatus && window.innerWidth < 1024) statusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hasStatus]);

  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError(t.notImage);
    try {
      setImage(await prepareImage(file));
      setError(null);
    } catch {
      setError(t.imageError);
    }
  }

  async function generate(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setSteps([]);
    setWarnings([]);
    setNoCredits(false);
    setError(null);
    const notes = [values.notes, questions && answers ? `Additional details: ${answers}` : ""].filter(Boolean).join("\n");
    setQuestions(null);

    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, ...values, notes, evidence, image: image ? { mediaType: image.mediaType, data: image.data, borderWhite: image.borderWhite } : undefined }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        if (res.status === 402) return setNoCredits(true);
        if (res.status === 401) return router.push("/login?next=/listings/new");
        throw new Error(errorText(T, body?.error));
      }
      const finished = await readNdjson(res, (ev) => {
        switch (ev.type) {
          case "step":
            setSteps((prev) => upsertStep(prev, ev));
            return false;
          case "warning":
            setWarnings((w) => [...w, String(ev.message)]);
            return false;
          case "needs_info":
            setQuestions(ev.questions as string[]);
            return true;
          case "no_credits":
            setNoCredits(true);
            return true;
          case "error":
            setError(errorText(T, ev));
            return true;
          case "done":
            router.push(`/listings/${ev.id}`);
            return true;
        }
      });
      if (!finished) setError(T.apiErrors.connection);
    } catch (err) {
      setError(err instanceof Error ? err.message : T.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <form onSubmit={generate} className="space-y-5">
        <div>
          <p className="text-sm font-medium text-slate-700">{T.marketplace}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {MARKETS.map((m) => (
              <button type="button" key={m.id} onClick={() => setPlatform(m.id)} className={`rounded-lg px-3 py-2 text-sm font-medium ring-1 ${platform === m.id ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"}`}>
                {T.markets[m.id]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">{T.marketHint}</p>
        </div>

        {FIELDS.map((f) => (
          <label key={f.key} className="block text-sm">
            <span className="font-medium text-slate-700">{t.fields[f.key].label}</span>
            {f.rows ? (
              <textarea rows={f.rows} maxLength={f.key === "sellingPoints" ? 3000 : 2000} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} placeholder={t.fields[f.key].placeholder} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none" />
            ) : (
              <input required={f.required} maxLength={f.key === "productName" ? 200 : 300} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} placeholder={t.fields[f.key].placeholder} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none" />
            )}
          </label>
        ))}

        <EvidencePicker value={evidence} onChange={setEvidence} />

        <div className="text-sm">
          <span className="font-medium text-slate-700">{t.image}</span>
          <div className="mt-2 flex items-center gap-4">
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.preview} alt="Product" className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200" />
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onImage} className="text-sm" />
            {image && <button type="button" onClick={() => setImage(null)} className="text-slate-500 hover:underline">{T.common.remove}</button>}
          </div>
          <p className="mt-1 text-xs text-slate-500">{t.imageNote}</p>
        </div>

        <button disabled={busy} className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
          {busy ? T.common.working : t.generate}
        </button>
        <p className="text-center text-xs text-slate-500">{t.chargeNote}</p>
      </form>

      <aside ref={statusRef} className="scroll-mt-20 space-y-4">
        <Progress steps={steps} />
        {warnings.map((w) => <p key={w} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{w}</p>)}

        {questions && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
            <p className="text-sm font-semibold text-indigo-900">{t.needInfo}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-indigo-900">{questions.map((q) => <li key={q}>{q}</li>)}</ul>
            <textarea rows={3} value={answers} onChange={(e) => setAnswers(e.target.value)} placeholder={t.answerPlaceholder} className="mt-3 w-full rounded-lg border border-indigo-200 px-3 py-2 text-sm focus:outline-none" />
            <button onClick={() => generate()} disabled={busy || !answers.trim()} className="mt-2 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{t.continue}</button>
          </div>
        )}

        {noCredits && (
          <div className="rounded-2xl border border-slate-200 p-5 text-sm">
            <p className="font-semibold text-slate-900">{t.noCreditsTitle}</p>
            <p className="mt-1 text-slate-600">{t.noCreditsBody}</p>
            <Link href="/pricing" className="mt-3 inline-block font-semibold text-indigo-600 hover:underline">{T.common.seePlans}</Link>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </aside>
    </div>
  );
}
