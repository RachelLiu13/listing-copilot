import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in · Listing Copilot" };

export default function LoginPage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-4 py-12">
      <Suspense>
        <LoginForm googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_AUTH === "on"} />
      </Suspense>
    </main>
  );
}
