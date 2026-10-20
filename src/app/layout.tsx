import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Header from "@/components/Header";
import { LocaleProvider } from "@/lib/i18n/client";
import { getLocale, getT } from "@/lib/i18n/server";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const HTML_LANG = { en: "en", zh: "zh-CN", vi: "vi", es: "es", ja: "ja" } as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.meta.title, description: t.meta.description };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const t = await getT();
  return (
    <html lang={HTML_LANG[locale]}>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <LocaleProvider locale={locale}>
          <Header />
          {children}
          <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400">
            <p>{t.footer}</p>
            <p className="mt-2 space-x-4">
              <Link href="/terms" className="hover:text-slate-600">{t.legal.terms}</Link>
              <Link href="/privacy" className="hover:text-slate-600">{t.legal.privacy}</Link>
              <Link href="/refunds" className="hover:text-slate-600">{t.legal.refunds}</Link>
            </p>
          </footer>
        </LocaleProvider>
      </body>
    </html>
  );
}
