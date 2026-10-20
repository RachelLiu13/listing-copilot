import EvidenceManager from "./EvidenceManager";

export const metadata = { title: "Evidence library · Listing Copilot" };

export default function EvidencePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Evidence library</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-500">Test reports, certificates and registrations you hold. When you pick them for a listing, claims they cover can stay (marked “keep the document ready”); claims without a document are rewritten so they cannot get the listing removed.</p>
      <div className="mt-8"><EvidenceManager /></div>
    </main>
  );
}
