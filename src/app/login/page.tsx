import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";
import LoginForm from "./LoginForm";

export async function generateMetadata() {
  return { title: (await getT()).login.metaTitle };
}

export default function LoginPage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-4 py-12">
      <Suspense>
        <LoginForm googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_AUTH === "on"} />
      </Suspense>
    </main>
  );
}
