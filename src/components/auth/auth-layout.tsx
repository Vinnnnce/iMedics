import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { HealthcareAnimation } from "./healthcare-animation";

export function AuthLayout({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <aside className="auth-story">
        <Link href="/" aria-label="Medic1905 home"><Image src="/medic1905-logo.png" alt="Medic1905" width={465} height={180} priority className="h-12 w-auto rounded-lg bg-white p-2" /></Link>
        <div>
          <h2>Intelligent Healthcare,<br />Connected.</h2>
          <p>Your care, your team and your records.<br />Together in one place.</p>
          <HealthcareAnimation />
        </div>
        <p className="auth-story-foot"><ShieldCheck aria-hidden="true" className="size-5" /> Care connects us. Privacy protects us.</p>
      </aside>
      <section className="auth-form-region">
        <div className="auth-form-wrap">
          <Link href="/" className="mb-8 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" /> Back to Medic1905</Link>
          <Image src="/medic1905-logo.png" alt="Medic1905" width={465} height={180} priority className="mb-6 h-12 w-auto rounded-lg bg-white p-2 lg:hidden" />
          <svg className="auth-mobile-signal lg:hidden" viewBox="0 0 240 24" role="img" aria-label="Connected healthcare pulse"><path d="M0 12 H80 L90 7 L100 19 L110 2 L120 20 L130 12 H240" /></svg>
          <header className="mb-6"><h1 className="text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></header>
          {children}
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">Medic1905 provides healthcare software, not medical care. Your healthcare professional remains responsible for clinical decisions.</p>
          <nav aria-label="Authentication policies" className="mt-5 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <Link href="/legal/privacy">Privacy</Link><Link href="/legal/terms">Terms</Link><Link href="/legal/cookies">Cookies</Link>
          </nav>
        </div>
      </section>
    </div>
  );
}
