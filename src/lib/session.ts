import "server-only";
import { cookies } from "next/headers";
import { currentUser } from "./supabase/server";

/**
 * Like currentUser(), but never throws, so pages still render if a service is
 * down or unconfigured. Reading cookies first marks the page as per-request,
 * so the header never shows a cached signed-out state.
 */
export async function optionalUser() {
  await cookies();
  try {
    return await currentUser();
  } catch {
    return null;
  }
}
