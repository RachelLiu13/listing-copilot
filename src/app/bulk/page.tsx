import { getT } from "@/lib/i18n/server";
import BulkRunner from "./BulkRunner";

export async function generateMetadata() {
  return { title: (await getT()).bulk.metaTitle };
}

export default async function BulkPage() {
  const t = await getT();
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">{t.bulk.title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-500">{t.bulk.lead}</p>
      <div className="mt-8"><BulkRunner /></div>
    </main>
  );
}
