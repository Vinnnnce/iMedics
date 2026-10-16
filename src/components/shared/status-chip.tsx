import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
const tones = {
  neutral: "border-border bg-muted text-foreground",
  success: "border-success/30 bg-success/10 text-foreground",
  warning: "border-warning/40 bg-warning/10 text-foreground",
  danger: "border-destructive/40 bg-destructive/10 text-foreground",
} as const;
export function StatusChip({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof tones }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium", tones[tone])}>
    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />{children}
  </span>;
}
