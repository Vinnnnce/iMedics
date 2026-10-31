import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { ThemeProvider } from "@/components/theme-provider";
import { MeProvider } from "@/lib/use-me";
import { getNavMe } from "@/lib/me";

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
const themeInitScript = `try{var s=localStorage.getItem("imedics.theme");var d=s?s==="system"?window.matchMedia("(prefers-color-scheme: dark)").matches:s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;var c=document.documentElement.classList;c.remove("dark","light");c.add(d?"dark":"light");}catch(e){}`;

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
              <Navbar>{children}</Navbar>
            </MeProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
