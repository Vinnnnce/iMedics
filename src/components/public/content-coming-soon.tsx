import Link from "next/link";
import { Newspaper, Mic } from "lucide-react";

/** Shown on the public news and podcast pages until the feature is switched on. */
export function ContentComingSoon({ kind }: { kind: "news" | "podcasts" }) {
  const Icon = kind === "news" ? Newspaper : Mic;
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-3 px-4 text-center">
      <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6" />
      </span>
      <h1 className="text-2xl font-bold">{kind === "news" ? "News" : "Podcasts"} are coming soon</h1>
      <p className="text-sm text-muted-foreground">
        We&apos;re preparing health news and podcast episodes for you. Check back shortly.
      </p>
      <Link href="/" className="text-sm font-medium underline underline-offset-4">Back to home</Link>
    </main>
  );
}
