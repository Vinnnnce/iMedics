import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { AudienceSection, PolicyAudience, PolicySection } from "@/lib/legal/types";
import { AUDIENCE_LABELS, LEGAL_DISCLAIMER, LEGAL_META, LEGAL_SOURCES } from "@/lib/legal/types";

interface LegalPolicyProps {
  /** Policy display title. */
  title: string;
  /** Resolved audience for the signed-in user, or GENERAL. */
  audience: PolicyAudience;
  /** Common sections shown to every audience. */
  common: PolicySection[];
  /** Audience-specific sections. */
  audiences: AudienceSection[];
  /** Short summary shown under the title. */
  intro: string;
  /** Related policy links rendered at the top and bottom. */
  related: { href: string; label: string }[];
}

function SectionBlock({ section }: { section: PolicySection }) {
  const { heading, paragraphs, bullets, note, id } = section;
  return (
    <section id={id} className="scroll-mt-24 space-y-2">
      <h2 className="text-base font-semibold text-foreground">{heading}</h2>
      {paragraphs?.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
      {bullets && bullets.length > 0 && (
        <ul className="list-disc list-inside space-y-1 ml-2">
          {bullets.map((bullet, index) => (
            <li key={index}>{bullet}</li>
          ))}
        </ul>
      )}
      {note && (
        <p className="rounded-lg border border-border bg-muted/50 p-3 text-xs leading-relaxed text-foreground">
          {note}
        </p>
      )}
    </section>
  );
}

/**
 * Renders a legal policy tailored to the viewer's account type. Users with a
 * known account type see the common sections plus their own audience sections;
 * signed-out visitors and other accounts see the common sections plus every
 * audience section, clearly labelled per account type.
 */
export function LegalPolicy({ title, audience, common, audiences, intro, related }: LegalPolicyProps) {
  const tailored = audience !== "GENERAL";
  const shown = tailored
    ? audiences.filter((block) => block.audience === audience)
    : audiences;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-0 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="text-xs text-muted-foreground">
          Last updated: {LEGAL_META.lastUpdated} · Version {LEGAL_META.version}
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">{intro}</p>
        <p className="text-xs rounded-lg border border-border bg-card px-3 py-2 text-muted-foreground">
          {tailored
            ? `You are viewing the version of this policy tailored to your ${AUDIENCE_LABELS[audience]} account.`
            : "You are viewing the general version of this policy, which includes the sections for every account type: Patient, Doctor, Hospital, Laboratory and Diagnostic centre."}
        </p>
        <nav aria-label="Related policies" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {related.map((item) => (
            <Link key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground transition-colors">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <Card className="bg-card border-border">
        <CardContent className="space-y-6 p-4 md:p-6 text-sm text-muted-foreground leading-relaxed">
          {/* Table of contents */}
          <nav aria-label="On this page" className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">On this page</p>
            <ul className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              {common.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="hover:text-foreground transition-colors">
                    {section.heading}
                  </a>
                </li>
              ))}
              {shown.map((block) => (
                <li key={`toc-${block.audience}`}>
                  <a href={`#${block.audience}`} className="hover:text-foreground transition-colors">
                    {tailored
                      ? "For your account type"
                      : `For ${AUDIENCE_LABELS[block.audience]} accounts`}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {common.map((section) => (
            <SectionBlock key={section.id} section={section} />
          ))}

          {shown.map((block) => (
            <div
              key={block.audience}
              id={block.audience}
              className="scroll-mt-24 space-y-4 border-t border-border pt-6"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
                {tailored
                  ? `For your ${AUDIENCE_LABELS[block.audience]} account`
                  : `For ${AUDIENCE_LABELS[block.audience]} accounts`}
              </p>
              {block.sections.map((section) => (
                <SectionBlock key={section.id} section={section} />
              ))}
            </div>
          ))}

          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Legal sources</p>
            <ul className="mt-2 space-y-1 text-xs">
              {LEGAL_SOURCES.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
                  >
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs leading-relaxed text-muted-foreground">{LEGAL_DISCLAIMER}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              {LEGAL_META.platformName} is operated by {LEGAL_META.operatorName} (RC{" "}
              {LEGAL_META.operatorRc}). Privacy questions and data requests:{" "}
              <a className="underline underline-offset-2" href={`mailto:${LEGAL_META.contactEmail}`}>
                {LEGAL_META.contactEmail}
              </a>
              .
            </p>
          </div>
        </CardContent>
      </Card>

      <nav aria-label="Related policies" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {related.map((item) => (
          <Link key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground transition-colors">
            {item.label}
          </Link>
        ))}
        <Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">
          About Medic1905
        </Link>
      </nav>
    </div>
  );
}
