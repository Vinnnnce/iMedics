import { cn } from "@/lib/utils";

/** A pulsing placeholder block shown while content streams in. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-lg bg-muted", className)} {...props} />;
}

/**
 * A generic page skeleton (title, summary tiles, list rows) used by the
 * route-level loading.tsx files so navigation shows structure instantly
 * instead of a blank screen or a lone spinner.
 */
export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
