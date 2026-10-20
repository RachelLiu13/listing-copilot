import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-slate-900">{t.errors.notFound}</h1>
      <p className="mt-2 text-sm text-slate-600">{t.errors.notFoundBody}</p>
      <Link href="/dashboard" className="mt-6 inline-block text-sm font-semibold text-indigo-600 hover:underline">{t.errors.goToListings}</Link>
    </main>
  );
}
