import BulkRunner from "./BulkRunner";

export const metadata = { title: "Bulk listings · Listing Copilot" };

export default function BulkPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Bulk listings</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-500">Upload a CSV of up to 50 products. Each one goes through the same five steps and checks as a single listing; download them all as one CSV for your flat-file upload. Keep this tab open while it runs.</p>
      <div className="mt-8"><BulkRunner /></div>
    </main>
  );
}
