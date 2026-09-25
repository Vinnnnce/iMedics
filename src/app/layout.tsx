import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SideNav } from "@/components/shared/side-nav";
import { MobileNav } from "@/components/shared/mobile-nav";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Medic1905 — Telemedicine Platform",
  description: "Modern telemedicine & medical records platform with AI-powered diagnostics",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans`}>
        <div className="min-h-screen bg-background text-foreground">
          <div className="flex">
            <SideNav />
            <main className="flex-1 md:ml-72 min-h-screen pb-20 md:pb-0">
              <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
                {children}
              </div>
            </main>
          </div>
          <MobileNav />
        </div>
      </body>
    </html>
  );
}
