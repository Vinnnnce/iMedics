import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import "./experience.css";
import { Navbar } from "@/components/layout/navbar";
import { ThemeProvider } from "@/components/theme-provider";
import { MeProvider } from "@/lib/use-me";
import { getNavMe } from "@/lib/me";
import { CookiePreferences } from "@/components/legal/cookie-preferences";
import { PolicyConsentNotice } from "@/components/legal/policy-consent-notice";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Medic1905 — Nigeria 1st Telemedicine",
  description: "Connect with doctors, hospitals, diagnostic centres and laboratories anywhere nationwide. Get AI-powered health insights.",
};

/**
 * Runs before hydration to apply the stored theme preference, or the operating
 * system's preferred colour scheme on a first visit. Setting the class on
 * <html> here avoids a flash of the wrong theme during page load.
 */
const themeInitScript = `try{var p=JSON.parse(localStorage.getItem("medic1905.consent.v1")||"null");var a=p?Date.now()-Date.parse(p.savedAt):NaN;var ok=p&&p.version===1&&p.essential===true&&["preferences","analytics","performance","marketing"].every(function(k){return typeof p[k]==="boolean"})&&Number.isFinite(a)&&a>=-60000&&a<=15552000000;var s=ok&&p.preferences?localStorage.getItem("imedics.theme"):null;var d=s?s==="system"?window.matchMedia("(prefers-color-scheme: dark)").matches:s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;var c=document.documentElement.classList;c.remove("dark","light");c.add(d?"dark":"light");}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getNavMe();
  return (
    <ClerkProvider>
      {/* suppressHydrationWarning: the theme-init script below mutates the
          class attribute on <html> before React hydrates. */}
      <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
        <body className="min-h-full flex flex-col bg-background text-foreground">
          <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
          <ThemeProvider>
            <MeProvider initialMe={me}>
              <Navbar><PolicyConsentNotice />{children}</Navbar>
              <CookiePreferences />
            </MeProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
