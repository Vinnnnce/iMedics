import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card px-6 py-4">
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-xs text-muted-foreground">
          © 2026 Medic1905. Serving Nigeria. All rights reserved.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/legal/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <Link href="/legal/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Terms of Use
          </Link>
          <Link href="/legal/cookies" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Cookies Policy
          </Link>
          <span className="hidden sm:inline text-xs text-border">|</span>
          <Link href="/admin" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Admin Panel
          </Link>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3 sm:justify-end">
        <span className="text-xs font-medium text-muted-foreground">Download App:</span>
        <a href="#" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5h18M6 12h12M10 19h4"/></svg>
          Windows
        </a>
        <a href="#" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
          iOS
        </a>
        <a href="#" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 7l5 5-5 5M14 7l5 5-5 5"/></svg>
          Android
        </a>
      </div>
    </footer>
  );
}
