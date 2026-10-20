import Link from "next/link";
import { optionalUser } from "@/lib/session";

export default async function Header() {
  const user = await optionalUser();
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm text-white">LC</span>
          <span className="hidden sm:inline">Listing Copilot</span>
        </Link>
        <nav className="flex items-center gap-1 whitespace-nowrap text-sm sm:gap-4">
          <Link href="/pricing" className="rounded-md px-2 py-1 text-slate-600 hover:text-slate-900">Pricing</Link>
          {user ? (
            <>
              <Link href="/dashboard" className="rounded-md px-2 py-1 text-slate-600 hover:text-slate-900">My listings</Link>
              <form action="/auth/signout" method="post">
                <button className="rounded-md px-2 py-1 text-slate-600 hover:text-slate-900">Sign out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-md px-2 py-1 text-slate-600 hover:text-slate-900">Sign in</Link>
              <Link href="/login?mode=signup" className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500">Try free</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
