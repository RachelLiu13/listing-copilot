"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type StepState = { step: string; label: string; status: "running" | "done"; detail?: string };
type Image = { mediaType: "image/jpeg"; data: string; preview: string };

const FIELDS: { key: string; label: string; placeholder: string; rows?: number; required?: boolean }[] = [
  { key: "productName", label: "Product name", placeholder: "e.g. 硅胶折叠水杯 · Ly silicon gấp gọn · Taza plegable de silicona", required: true },
  { key: "brand", label: "Brand (optional)", placeholder: "Your own brand name" },
  { key: "sellingPoints", label: "Selling points", placeholder: "Folds to 2 cm, hanging hook, one-piece leak-proof body…", rows: 4 },
  { key: "material", label: "Material", placeholder: "Food-grade silicone + PP lid" },
  { key: "dimensions", label: "Size, capacity, quantity", placeholder: "9 cm tall, 350 ml, set of 2" },
  { key: "targetAudience", label: "Who buys it", placeholder: "Campers, hikers, travelers" },
  { key: "notes", label: "Other notes", placeholder: "Colors: gray, green. Dishwasher safe.", rows: 3 },
];

/** Resize in the browser so uploads stay small (≤1024px JPEG) and the original photo never leaves the device. */
async function resizeImage(file: File): Promise<Image> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const preview = canvas.toDataURL("image/jpeg", 0.85);
  return { mediaType: "image/jpeg", data: preview.split(",")[1], preview };
}

export default function NewListingForm() {
  const router = useRouter();
  const [platform, setPlatform] = useState<"amazon_us" | "tiktok_us">("amazon_us");
  const [values, setValues] = useState<Record<string, string>>({});
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
    if (!file.type.startsWith("image/")) return setError("Please choose an image file.");
    try {
      setImage(await resizeImage(file));
      setError(null);
    } catch {
      setError("That image could not be read. Try a JPG or PNG.");
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
        body: JSON.stringify({ platform, ...values, notes, image: image ? { mediaType: image.mediaType, data: image.data } : undefined }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        if (res.status === 402) return setNoCredits(true);
        if (res.status === 401) return router.push("/login?next=/listings/new");
        throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const ev = JSON.parse(line);
          if (ev.type === "step") {
            setSteps((prev) => {
              const others = prev.filter((s) => s.step !== ev.step);
              return [...others, { step: ev.step, label: ev.label, status: ev.status, detail: ev.detail }];
            });
          } else if (ev.type === "warning") setWarnings((w) => [...w, ev.message]);
          else if (ev.type === "needs_info") {
            setQuestions(ev.questions);
            finished = true;
          } else if (ev.type === "no_credits") {
            setNoCredits(true);
            finished = true;
          } else if (ev.type === "error") {
            setError(ev.message);
            finished = true;
          } else if (ev.type === "done") {
            finished = true;
            router.push(`/listings/${ev.id}`);
            return;
          }
        }
      }
      if (!finished) setError("The connection closed before the listing was ready. If a listing appears in My listings, it was saved; otherwise please try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <form onSubmit={generate} className="space-y-5">
        <div>
          <p className="text-sm font-medium text-slate-700">Marketplace</p>
          <div className="mt-2 flex gap-2">
            {(["amazon_us", "tiktok_us"] as const).map((p) => (
              <button type="button" key={p} onClick={() => setPlatform(p)} className={`rounded-lg px-4 py-2 text-sm font-medium ring-1 ${platform === p ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"}`}>
                {p === "amazon_us" ? "Amazon US" : "TikTok Shop US"}
              </button>
            ))}
          </div>
        </div>

        {FIELDS.map((f) => (
          <label key={f.key} className="block text-sm">
            <span className="font-medium text-slate-700">{f.label}</span>
            {f.rows ? (
              <textarea rows={f.rows} maxLength={f.key === "sellingPoints" ? 3000 : 2000} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none" />
            ) : (
              <input required={f.required} maxLength={f.key === "productName" ? 200 : 300} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none" />
            )}
          </label>
        ))}

        <div className="text-sm">
          <span className="font-medium text-slate-700">Product photo (optional)</span>
          <div className="mt-2 flex items-center gap-4">
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.preview} alt="Product" className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200" />
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onImage} className="text-sm" />
            {image && <button type="button" onClick={() => setImage(null)} className="text-slate-500 hover:underline">Remove</button>}
          </div>
          <p className="mt-1 text-xs text-slate-500">Used once to read visible details. It is not stored.</p>
        </div>

        <button disabled={busy} className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
          {busy ? "Working…" : "Generate listing (1 credit)"}
        </button>
        <p className="text-center text-xs text-slate-500">You are only charged when a full listing is written. Questions and failures are free.</p>
      </form>

      <aside ref={statusRef} className="space-y-4 scroll-mt-20">
        {steps.length > 0 && (
          <div className="rounded-2xl border border-slate-200 p-5">
            <p className="text-sm font-semibold text-slate-900">Progress</p>
            <ol className="mt-3 space-y-3">
              {steps.map((s) => (
                <li key={s.step} className="flex gap-3 text-sm">
                  <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full ${s.status === "done" ? "bg-emerald-500" : "animate-pulse bg-indigo-400"}`} />
                  <span>
                    <span className="text-slate-800">{s.label}</span>
                    {s.detail && <span className="block text-xs text-slate-500">{s.detail}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {warnings.map((w) => <p key={w} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{w}</p>)}

        {questions && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
            <p className="text-sm font-semibold text-indigo-900">Need a little more information (no credit used)</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-indigo-900">{questions.map((q) => <li key={q}>{q}</li>)}</ul>
            <textarea rows={3} value={answers} onChange={(e) => setAnswers(e.target.value)} placeholder="Answer here in any language, or add the details to the form" className="mt-3 w-full rounded-lg border border-indigo-200 px-3 py-2 text-sm focus:outline-none" />
            <button onClick={() => generate()} disabled={busy || !answers.trim()} className="mt-2 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Continue</button>
          </div>
        )}

        {noCredits && (
          <div className="rounded-2xl border border-slate-200 p-5 text-sm">
            <p className="font-semibold text-slate-900">You have used your free listings</p>
            <p className="mt-1 text-slate-600">Buy a credit pack or go Pro to keep writing. Nothing was charged for this attempt.</p>
            <Link href="/pricing" className="mt-3 inline-block font-semibold text-indigo-600 hover:underline">See plans →</Link>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </aside>
    </div>
  );
}
