import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Not found</h1>
      <p className="mt-2 text-sm text-slate-600">That page or listing does not exist, or it belongs to another account.</p>
      <Link href="/dashboard" className="mt-6 inline-block text-sm font-semibold text-indigo-600 hover:underline">Go to my listings</Link>
    </main>
  );
}
