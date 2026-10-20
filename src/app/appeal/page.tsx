import { redirect } from "next/navigation";
import { currentUser, supabaseForUser } from "@/lib/supabase/server";
import AppealForm from "./AppealForm";

export const metadata = { title: "Takedown help · Listing Copilot" };
export const dynamic = "force-dynamic";

export default async function AppealPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/appeal");
  const supabase = await supabaseForUser();
  const { data } = await supabase.from("listings").select("id,product_name").order("created_at", { ascending: false }).limit(50);
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Listing removed or flagged?</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-500">Paste the notice. We explain what happened in your language, find the words that most likely triggered it, list the exact fixes, and draft the appeal in English.</p>
      <div className="mt-8"><AppealForm listings={(data ?? []).map((l) => ({ id: l.id, name: l.product_name }))} /></div>
    </main>
  );
}
