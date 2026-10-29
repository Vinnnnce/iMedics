import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { Completeness } from "@/lib/profile-completeness";

/** Dashboard card: progress toward a complete public profile and what to do next. Hidden at 100%. */
export function ProfileCompletenessCard({ completeness, title }: { completeness: Completeness; title: string }) {
  if (completeness.missing.length === 0) return null;
  return (
    <Card className="beeline-card" data-testid="card-profile-completeness">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{title}</p>
          <span className="text-xs font-medium tabular-nums">{completeness.percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={completeness.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={title}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-foreground" style={{ width: `${completeness.percent}%` }} />
        </div>
        <ul className="space-y-1">
          {completeness.missing.slice(0, 4).map((item) => (
            <li key={item.key}>
              <Link href={item.href} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
