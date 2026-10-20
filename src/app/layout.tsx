import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Listing Copilot · US-ready listings for cross-border sellers",
  description: "Turn product notes in any language into Amazon US and TikTok Shop US listings that read naturally, rank on US search terms and pass a compliance check.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <Header />
        {children}
        <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400">
          Listing Copilot · AI drafts are suggestions: review every listing before you publish it.
        </footer>
      </body>
    </html>
  );
}
