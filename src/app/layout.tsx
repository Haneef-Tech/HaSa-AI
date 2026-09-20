import type { Metadata } from "next";
import Script from "next/script";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { AnalyticsInit } from "@/components/analytics/AnalyticsInit";

export const metadata: Metadata = {
  title: "HaSa AI — Provider-agnostic AI workspace",
  description:
    "HaSa AI routes across Groq, Gemini, and OpenRouter behind one secure chat API. Phase 2: Firebase auth + Firestore persistence + mock streaming.",
};

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

// Light is the default theme; a remembered choice wins. Runs before paint.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('hasa-theme');if(t!=='dark'&&t!=='light')t='light';var h=document.documentElement;h.classList.remove('light','dark');h.classList.add(t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`light ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Script id="hasa-theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <AuthProvider>{children}</AuthProvider>
        <AnalyticsInit />
      </body>
    </html>
  );
}
