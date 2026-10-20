import "server-only";
import { supabaseAdmin } from "./supabase/server";
import type { StepUsage } from "./listing/types";

export interface Profile {
  id: string;
  email: string;
  plan: "free" | "pro";
  credits: number;
  pro_until: string | null;
  stripe_customer_id: string | null;
}

export const isActivePro = (p: Pick<Profile, "plan" | "pro_until">) =>
  p.plan === "pro" && (!p.pro_until || new Date(p.pro_until) > new Date());

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabaseAdmin().from("profiles").select("id,email,plan,credits,pro_until,stripe_customer_id").eq("id", userId).maybeSingle();
  return (data as Profile | null) ?? null;
}

/** Ensures a profile exists (the signup trigger normally creates it). */
export async function ensureProfile(userId: string, email: string): Promise<Profile> {
  const existing = await getProfile(userId);
  if (existing) return existing;
  await supabaseAdmin().from("profiles").upsert({ id: userId, email }, { onConflict: "id", ignoreDuplicates: true });
  const created = await getProfile(userId);
  if (!created) throw new Error("Could not create the user profile");
  return created;
}

export type ChargeResult = "pro" | "charged" | "no_credits";
export type EventKind = "generate" | "rewrite" | "audit" | "appeal" | "explain";

export async function consumeCredit(userId: string): Promise<ChargeResult> {
  const { data, error } = await supabaseAdmin().rpc("consume_credit", { p_user: userId });
  if (error) throw new Error(`consume_credit failed: ${error.message}`);
  return data as ChargeResult;
}

export async function refundCredit(userId: string): Promise<void> {
  const { error } = await supabaseAdmin().rpc("refund_credit", { p_user: userId });
  if (error) console.error("refund_credit failed", { userId, error: error.message });
}

export async function recordEvent(
  userId: string,
  kind: EventKind,
  outcome: "started" | "needs_info" | "complete" | "failed" | "no_credits",
  detail?: string,
  usage: StepUsage[] = [],
): Promise<void> {
  const input_tokens = usage.reduce((s, u) => s + u.inputTokens, 0);
  const output_tokens = usage.reduce((s, u) => s + u.outputTokens, 0);
  const { error } = await supabaseAdmin().from("generation_events").insert({ user_id: userId, kind, outcome, detail: detail?.slice(0, 500), input_tokens, output_tokens });
  if (error) console.error("recordEvent failed", error.message);
}

const PER_MINUTE = 4;
const PER_DAY = 60;

/** Caps model calls per user so a script (or a stuck button) cannot run up the API bill. */
export async function checkRateLimit(userId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = supabaseAdmin();
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const count = async (ms: number) => {
    const { count: n } = await db.from("generation_events").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("outcome", "started").gte("created_at", since(ms));
    return n ?? 0;
  };
  if ((await count(60_000)) >= PER_MINUTE) return { ok: false, message: "You are going a bit fast. Please wait a minute and try again." };
  if ((await count(86_400_000)) >= PER_DAY) return { ok: false, message: "You have reached today's limit. Please come back tomorrow." };
  return { ok: true };
}
