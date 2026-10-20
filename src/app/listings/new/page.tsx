import { getT } from "@/lib/i18n/server";
import NewListingForm from "./NewListingForm";

export async function generateMetadata() {
  return { title: (await getT()).newListing.metaTitle };
}

export default async function NewListingPage() {
  const t = await getT();
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">{t.newListing.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{t.newListing.lead}</p>
      <div className="mt-8"><NewListingForm /></div>
    </main>
  );
}
