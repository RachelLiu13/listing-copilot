import AuditForm from "./AuditForm";

export const metadata = { title: "Audit a listing · Listing Copilot" };

export default function AuditPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Audit a live listing</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-500">Paste a listing that is already online. You get a takedown-risk score, every risky phrase explained in your language, and a fixed version that changes only what it must.</p>
      <div className="mt-8"><AuditForm /></div>
    </main>
  );
}
