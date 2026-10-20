import { redirect } from "next/navigation";
import { ensureProfile, isActivePro } from "@/lib/account";
import { getLocale } from "@/lib/i18n/server";
import { DICTS } from "@/lib/i18n/dict";
import { currentUser } from "@/lib/supabase/server";
import AccountView from "./AccountView";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: DICTS[await getLocale()].account.metaTitle };
}

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");
  const profile = await ensureProfile(user.id, user.email ?? "");
  const locale = await getLocale();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <AccountView
        email={user.email ?? ""}
        pro={isActivePro(profile)}
        proUntil={profile.pro_until ? new Date(profile.pro_until).toLocaleDateString(locale) : null}
        credits={profile.credits}
        hasBilling={Boolean(profile.stripe_customer_id)}
      />
    </main>
  );
}
