import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { serverEnv } from "../env";

/** Supabase as the signed-in user (cookie session). Row Level Security applies. */
export async function supabaseForUser() {
  const env = serverEnv();
  const store = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only; middleware refreshes them.
        }
      },
    },
  });
}

/**
 * Supabase with the service role: bypasses Row Level Security. Server only, and
 * only after the caller has been authenticated (or for verified Stripe webhooks).
 */
export function supabaseAdmin() {
  const env = serverEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The signed-in user, verified with Supabase Auth (not just decoded from the cookie). */
export async function currentUser() {
  const supabase = await supabaseForUser();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
