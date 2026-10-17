import type { ReactNode } from "react";
import { AlertCircle, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({ title = "Nothing to show yet", detail = "New activity will appear here.", action }: {
  title?: string; detail?: string; action?: ReactNode;
}) {
  return <div className="rounded-xl border border-dashed border-border p-6 text-center sm:p-10">
    <FolderOpen aria-hidden="true" className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
    <h2 className="text-sm font-semibold">{title}</h2>
    <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>;
}
export function ErrorState({ title = "Unable to load this section", detail = "Please try again. Your changes have not been confirmed.", action }: {
  title?: string; detail?: string; action?: ReactNode;
}) {
  return <div role="alert" className="rounded-xl border border-destructive/40 bg-card p-5">
    <h2 className="flex items-center gap-2 text-sm font-semibold"><AlertCircle aria-hidden="true" className="h-4 w-4" />{title}</h2>
    <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    {action && <div className="mt-3">{action}</div>}
  </div>;
}
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-lg bg-muted motion-reduce:animate-none", className)} />;
}
export function DashboardSkeleton() {
  return <div role="status" aria-label="Loading your dashboard" className="space-y-6">
    <span className="sr-only">Loading your dashboard…</span>
    <Skeleton className="h-8 w-52 max-w-full" /><Skeleton className="h-4 w-72 max-w-full" />
    <div className="grid grid-cols-1 gap-4 min-[390px]:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28" />)}
    </div><Skeleton className="h-64 w-full" />
  </div>;
}
