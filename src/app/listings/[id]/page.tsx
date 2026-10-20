import { notFound, redirect } from "next/navigation";
import type { ListingResult } from "@/lib/listing/types";
import { PLATFORMS } from "@/lib/listing/platforms";
import { currentUser, supabaseForUser } from "@/lib/supabase/server";
import ListingView from "./ListingView";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await supabaseForUser();
    const { data } = await supabase.from("listings").select("product_name").eq("id", id).maybeSingle();
    return { title: `${data?.product_name ?? "Listing"} · Listing Copilot` };
  } catch {
    return { title: "Listing · Listing Copilot" };
  }
}

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  // RLS: another user's id simply returns nothing.
  const supabase = await supabaseForUser();
  const { data } = await supabase.from("listings").select("id,product_name,platform,result,rewrites,created_at").eq("id", id).maybeSingle();
  if (!data?.result) notFound();
  const result = data.result as ListingResult;
  const rules = PLATFORMS[result.platform];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <ListingView
        id={data.id}
        productName={data.product_name}
        initial={result}
        rewritesUsed={data.rewrites}
        limits={{ label: rules.label, titleMax: rules.titleMax, bulletMax: rules.bulletMax, descriptionMax: rules.descriptionMax }}
      />
    </main>
  );
}
