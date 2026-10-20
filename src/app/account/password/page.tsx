import { getT } from "@/lib/i18n/server";
import PasswordForm from "./PasswordForm";

export async function generateMetadata() {
  return { title: (await getT()).newPassword.metaTitle };
}

/** Reached from "Change password", or from the reset email (signed in by /auth/callback). */
export default function NewPasswordPage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-4 py-12">
      <PasswordForm />
    </main>
  );
}
