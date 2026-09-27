import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ThemeProvider } from "@/components/theme-provider";

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
            <div className="flex min-h-screen">
              <Navbar />
              <div className="flex-1 flex flex-col min-w-0">
                <main className="flex-1 p-4 md:p-6 has-bottom-nav">{children}</main>
                <Footer />
              </div>
            </div>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
