import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { optionalUser } from "@/lib/session";
import LanguageSwitcher from "./LanguageSwitcher";

export default async function Header() {
  const [user, t] = await Promise.all([optionalUser(), getT()]);
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm text-white">LC</span>
          <span className="hidden sm:inline">Listing Copilot</span>
        </Link>
        <nav className="flex items-center gap-1 whitespace-nowrap text-sm sm:gap-3">
          <Link href="/pricing" className="hidden rounded-md px-2 py-1 text-slate-600 hover:text-slate-900 sm:inline">{t.nav.pricing}</Link>
          {user ? (
            <>
              <Link href="/dashboard" className="rounded-md px-2 py-1 text-slate-600 hover:text-slate-900">{t.nav.myListings}</Link>
              <Link href="/audit" className="hidden rounded-md px-2 py-1 text-slate-600 hover:text-slate-900 md:inline">{t.nav.audit}</Link>
              <Link href="/bulk" className="hidden rounded-md px-2 py-1 text-slate-600 hover:text-slate-900 md:inline">{t.nav.bulk}</Link>
              <Link href="/appeal" className="hidden rounded-md px-2 py-1 text-slate-600 hover:text-slate-900 lg:inline">{t.nav.takedown}</Link>
              <Link href="/evidence" className="hidden rounded-md px-2 py-1 text-slate-600 hover:text-slate-900 lg:inline">{t.nav.evidence}</Link>
              <LanguageSwitcher />
              <form action="/auth/signout" method="post">
                <button className="rounded-md px-2 py-1 text-slate-600 hover:text-slate-900">{t.nav.signOut}</button>
              </form>
            </>
          ) : (
            <>
              <LanguageSwitcher />
              <Link href="/login" className="rounded-md px-2 py-1 text-slate-600 hover:text-slate-900">{t.nav.signIn}</Link>
              <Link href="/login?mode=signup" className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500">{t.nav.tryFree}</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
