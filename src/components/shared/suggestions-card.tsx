import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Suggestion } from "@/lib/suggestions";

interface SuggestionsCardProps {
  items: Suggestion[];
  /** Section heading; defaults to "Suggestions for you". */
  title?: string;
}

/**
 * Account-specific suggestions. Rendered on the public homepage and on the
 * dashboard that matches the viewer's account type — the same placement
 * rules as the FAQ section.
 */
export function SuggestionsCard({ items, title = "Suggestions for you" }: SuggestionsCardProps) {
  if (items.length === 0) return null;

  return (
    <Card className="beeline-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((suggestion) => (
          <div
            key={suggestion.title}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{suggestion.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{suggestion.description}</p>
            </div>
            <Link
              href={suggestion.href}
              className="pill-btn pill-btn-primary inline-flex shrink-0 items-center justify-center px-4 py-2 text-xs font-semibold"
            >
              {suggestion.cta}
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
