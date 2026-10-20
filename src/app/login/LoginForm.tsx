"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useT } from "@/lib/i18n/client";

export default function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const { login: t, common } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(
    params.get("error") ? { kind: "error", text: t.expired } : null,
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = supabaseBrowser();
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage({ kind: "info", text: t.checkInbox });
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : common.somethingWrong;
      setMessage({ kind: "error", text: text.includes("Invalid login") ? t.wrong : text });
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) setMessage({ kind: "error", text: error.message });
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">{mode === "signin" ? t.signIn : t.create}</h1>
      <p className="mt-1 text-sm text-slate-500">{mode === "signup" ? t.freeNote : t.welcome}</p>

      {googleEnabled && (
        <>
          <button onClick={google} className="mt-6 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50">
            {t.google}
          </button>
          <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />{t.or}<span className="h-px flex-1 bg-slate-200" />
          </div>
        </>
      )}

      <form onSubmit={submit} className={googleEnabled ? "space-y-4" : "mt-6 space-y-4"}>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">{t.email}</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none" />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">{t.password}</span>
          <input type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none" />
        </label>
        {message && <p className={`text-sm ${message.kind === "error" ? "text-red-600" : "text-emerald-700"}`}>{message.text}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
          {busy ? t.wait : mode === "signin" ? t.signIn : t.createButton}
        </button>
      </form>

      <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="mt-5 w-full text-center text-sm text-indigo-600 hover:underline">
        {mode === "signin" ? t.toSignup : t.toSignin}
      </button>
    </div>
  );
}
