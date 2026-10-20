import { getT } from "@/lib/i18n/server";
import AuditForm from "./AuditForm";

export async function generateMetadata() {
  return { title: (await getT()).audit.metaTitle };
}

export default async function AuditPage() {
  const t = await getT();
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">{t.audit.title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-500">{t.audit.lead}</p>
      <div className="mt-8"><AuditForm /></div>
    </main>
  );
}
