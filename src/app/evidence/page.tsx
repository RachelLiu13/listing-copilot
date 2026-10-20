import { getT } from "@/lib/i18n/server";
import EvidenceManager from "./EvidenceManager";

export async function generateMetadata() {
  return { title: (await getT()).evidence.metaTitle };
}

export default async function EvidencePage() {
  const t = await getT();
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">{t.evidence.title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-500">{t.evidence.lead}</p>
      <div className="mt-8"><EvidenceManager /></div>
    </main>
  );
}
