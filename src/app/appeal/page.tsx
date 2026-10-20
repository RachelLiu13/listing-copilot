import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { currentUser, supabaseForUser } from "@/lib/supabase/server";
import AppealForm from "./AppealForm";

export async function generateMetadata() {
  return { title: (await getT()).appeal.metaTitle };
}
export const dynamic = "force-dynamic";

export default async function AppealPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/appeal");
  const supabase = await supabaseForUser();
  const t = await getT();
  const { data } = await supabase.from("listings").select("id,product_name").order("created_at", { ascending: false }).limit(50);
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">{t.appeal.title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-500">{t.appeal.lead}</p>
      <div className="mt-8"><AppealForm listings={(data ?? []).map((l) => ({ id: l.id, name: l.product_name }))} /></div>
    </main>
  );
}
