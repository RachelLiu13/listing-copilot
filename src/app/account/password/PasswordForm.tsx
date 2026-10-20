"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useT } from "@/lib/i18n/client";

export default function PasswordForm() {
  const { newPassword: t, login } = useT();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    setBusy(false);
    if (error) return setMessage({ kind: "error", text: error.message.includes("different from the old") ? error.message : t.failed });
    setMessage({ kind: "info", text: t.saved });
    setTimeout(() => router.replace("/dashboard"), 1200);
  }

  return (
    <form onSubmit={save} className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">{t.title}</h1>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">{t.label}</span>
        <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none" />
      </label>
      {message && <p className={`text-sm ${message.kind === "error" ? "text-red-600" : "text-emerald-700"}`}>{message.text}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
        {busy ? login.wait : t.save}
      </button>
    </form>
  );
}
