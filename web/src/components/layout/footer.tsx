import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card px-6 py-4">
      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <p className="text-xs text-muted-foreground">
          © 2026 Medic1905. All rights reserved.
        </p>
        <div className="flex items-center gap-4">
          <Link href="/legal/privacy" className="text-xs text-muted-foreground hover:text-primary transition-colors">
            Privacy Policy
          </Link>
          <Link href="/legal/terms" className="text-xs text-muted-foreground hover:text-primary transition-colors">
            Terms of Use
          </Link>
          <Link href="/legal/cookies" className="text-xs text-muted-foreground hover:text-primary transition-colors">
            Cookies Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
