"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useMe } from "@/lib/use-me";
import { POLICY_RELEASE } from "@/lib/legal/release";
import { POLICY_AUDIENCES, AUDIENCE_LABELS, policyAudienceFor, LEGAL_META, type PolicyAudience } from "@/lib/legal/types";
import { CookieSettingsButton } from "./cookie-preferences";

export function PolicyReader({ document }: { document: keyof typeof POLICY_RELEASE.documents }) {
  const me = useMe();
  const [selected, setSelected] = useState<PolicyAudience | null>(null);
  const [progress, setProgress] = useState(0);
  const requested = useSyncExternalStore(
    callback => { window.addEventListener("popstate", callback); return () => window.removeEventListener("popstate", callback); },
    () => new URLSearchParams(window.location.search).get("accountType"),
    () => null,
  );
  const audience = selected ?? (requested && POLICY_AUDIENCES.includes(requested as PolicyAudience) ? requested as PolicyAudience : policyAudienceFor(me as Parameters<typeof policyAudienceFor>[0]));
  const policy = POLICY_RELEASE.documents[document];
  const shown = policy.audiences.filter(block => audience === "GENERAL" || block.audience === audience);
  useEffect(() => {
    const update = () => {
      const height = documentElement().scrollHeight - window.innerHeight;
      setProgress(height > 0 ? Math.min(1, window.scrollY / height) : 1);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <article className="policy-layout">
      <div aria-hidden="true" className="policy-progress" style={{ transform: `scaleX(${progress})` }} />
      <header className="space-y-4">
        <ShieldCheck aria-hidden="true" className="size-8 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">{policy.title}</h1>
        <p className="text-sm text-muted-foreground">Clear information for your account, your responsibilities and your choices.</p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground"><span>Version {POLICY_RELEASE.version}</span><span>Updated {POLICY_RELEASE.updatedAt}</span><span>Effective: {POLICY_RELEASE.effectiveDate ?? "Not yet effective"}</span><span>{POLICY_RELEASE.status}</span></div>
        {POLICY_RELEASE.status === "DRAFT" && <p role="note" className="rounded-xl border border-border bg-muted p-4 text-sm">Draft for legal review. Not an approved or published legal agreement. Operator identity, vendor inventory, retention schedules and jurisdiction-specific obligations must be confirmed by qualified Nigerian legal counsel before publication.</p>}
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-sm">Account-specific information
            <select aria-label="Policy account type" className="ml-3 max-w-full rounded-lg border border-border bg-card p-3 text-foreground" value={audience} onChange={event => setSelected(event.target.value as PolicyAudience)}>
              {POLICY_AUDIENCES.map(value => <option key={value} value={value}>{AUDIENCE_LABELS[value]}</option>)}
            </select>
          </label>
          <CookieSettingsButton />
        </div>
        <nav aria-label="Legal documents" className="flex flex-wrap gap-5 text-sm">
          {Object.entries(POLICY_RELEASE.documents).map(([key, value]) => <Link key={key} href={`/legal/${key}`} aria-current={document === key ? "page" : undefined} className="underline underline-offset-4">{value.title}</Link>)}
          {me && <Link href="/legal/history" className="underline underline-offset-4">My policy history</Link>}
        </nav>
      </header>
      <div className="policy-reader">
        <nav aria-label="On this page" className="policy-toc">
          <p className="font-semibold">On this page</p>
          {policy.common.map(section => <a key={section.id} href={`#${section.id}`} className="text-muted-foreground hover:text-foreground">{section.heading}</a>)}
          {shown.map(block => <a key={block.audience} href={`#${block.audience}`} className="text-muted-foreground hover:text-foreground">For {AUDIENCE_LABELS[block.audience]} accounts</a>)}
        </nav>
        <div className="policy-text text-sm text-muted-foreground">
          {policy.common.map(section => <PolicySectionView key={section.id} section={section} />)}
          {shown.map(block => <div id={block.audience} key={block.audience} className="scroll-mt-24 border-t border-border pt-6">
            {block.sections.map(section => <PolicySectionView key={section.id} section={section} />)}
          </div>)}
          <section id="legal-review"><h2>Questions and review status</h2><p>Privacy enquiries: <a className="underline" href={`mailto:${LEGAL_META.contactEmail}`}>{LEGAL_META.contactEmail}</a>. This contact must be verified by the operator before publication. Account closure does not automatically delete clinical records held by healthcare providers under their independent legal obligations.</p><p>This draft does not promise universal regulatory compliance. Nigeria-first review should address the <a className="underline" href="https://ndpc.gov.ng/document/nigeria-data-protection-act-2023/">Nigeria Data Protection Act 2023</a>, applicable healthcare, professional and consumer obligations, operator/controller identity, processor agreements and retention requirements.</p><p>If GDPR territorial conditions apply, the operator must establish an Article 6 legal basis and, for health data, an applicable Article 9 condition; provide applicable access, correction, erasure, restriction, portability and objection rights; and assess international transfer safeguards. An EU representative or data protection officer may be required depending on the processing. These are conditional review requirements, not a statement of compliance. See the <a className="underline" href="https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng">official GDPR text, including Articles 3, 6, 9, 12–22 and Chapter V</a>.</p></section>
        </div>
      </div>
    </article>
  );
}

function documentElement() { return window.document.documentElement; }
function PolicySectionView({ section }: { section: typeof POLICY_RELEASE.documents.privacy.common[number] }) {
  return <section id={section.id}>
    <h2>{section.heading}</h2>
    {section.paragraphs?.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
    {section.bullets && <ul className="list-inside list-disc">{section.bullets.map((bullet, i) => <li key={i}>{bullet}</li>)}</ul>}
    {section.note && <p className="rounded-lg bg-muted p-4 text-foreground">{section.note}</p>}
  </section>;
}
