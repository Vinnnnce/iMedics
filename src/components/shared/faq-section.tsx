"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { FaqItem } from "@/lib/faqs";

interface FaqSectionProps {
  items: FaqItem[];
  /** Optional section heading; defaults to "Frequently asked questions". */
  title?: string;
  /** Optional intro line under the heading. */
  intro?: string;
  /** Optional classes for the section wrapper. */
  className?: string;
}

/**
 * Collapsible FAQ list. Shown only on the homepage and on the dashboard that
 * matches the viewer's account type — never in the sidebar footer.
 */
export function FaqSection({ items, title = "Frequently asked questions", intro, className }: FaqSectionProps) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="faq-heading" className={className ?? "mx-auto max-w-6xl px-4 md:px-6"}>
      <h2 id="faq-heading" className="text-2xl font-bold tracking-tight md:text-3xl">
        {title}
      </h2>
      {intro && (
        <p className="mt-2 text-sm text-muted-foreground md:text-base">{intro}</p>
      )}
      <div className="mt-6 space-y-3">
        {items.map((faq) => (
          <div key={faq.question} className="rounded-lg border border-border bg-card p-4">
            <Collapsible>
              <CollapsibleTrigger className="text-left text-sm font-medium text-foreground">
                {faq.question}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="pt-2 text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
              </CollapsibleContent>
            </Collapsible>
          </div>
        ))}
      </div>
    </section>
  );
}
