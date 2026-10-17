import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ThemeProvider } from "@/components/theme-provider";
import { GlobalToaster } from "@/components/shared/global-toaster";
import { OfflineBanner } from "@/components/shared/offline-banner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Medic1905 — AI-Powered Telemedicine",
  description: "Connect with doctors, upload lab results, and get AI-powered health insights.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col bg-background text-foreground">
          <ThemeProvider>
            <div className="flex min-h-screen flex-col">
              <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-card focus:p-3 focus:text-foreground">Skip to main content</a>
              <Navbar>
                <OfflineBanner />
                <main id="main-content" tabIndex={-1} className="flex-1 p-4 md:p-6 has-bottom-nav">{children}</main>
                <Footer />
              </Navbar>
            </div>
            <GlobalToaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
