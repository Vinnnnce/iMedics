import type { Metadata } from "next";
import { DownloadCentre } from "@/components/download/download-centre";
import { PublicEntryLink as Link } from "@/components/shared/public-entry-link";

export const metadata: Metadata = {
  title: "Download Medic1905 Medical Simulator — Android, iOS & Windows",
  description:
    "Get the Medic1905 Medical Simulator for Android (APK), iPhone/iPad (App Store) and Windows (EXE installer), or open the web simulator in your browser.",
};

export default function AppDownloadPage() {
  return (
    <main className="min-h-dvh">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
        <Link href="/" className="text-lg font-extrabold tracking-tight">
          Medic<span className="text-primary">1905</span>
        </Link>
        <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          Back to homepage
        </Link>
      </div>
      <DownloadCentre />
      <div className="mx-auto max-w-3xl px-4 pb-16 text-center text-xs text-muted-foreground md:px-6">
        <p>
          All Medic1905 applications connect to the same secure Medic1905 backend with your existing
          account. Installation packages are distributed from the official Medic1905 release
          channel — never install from untrusted sources.
        </p>
      </div>
    </main>
  );
}
