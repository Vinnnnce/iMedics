import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Minus, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

const tones = {
  neutral: "border-border bg-muted text-foreground",
  success: "border-success/30 bg-success/10 text-foreground",
  warning: "border-warning/40 bg-warning/10 text-foreground",
  danger: "border-destructive/40 bg-destructive/10 text-foreground",
  info: "border-info/40 bg-info/10 text-foreground",
} as const satisfies Record<StatusTone, string>;

/**
 * Icons pair with colour so status is never communicated by colour alone.
 * Green success · amber pending · red critical · blue informational · grey archived.
 */
const icons: Record<StatusTone, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
  neutral: Minus,
};

export function StatusChip({ children, tone = "neutral" }: { children: ReactNode; tone?: StatusTone }) {
  const Icon = icons[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium", tones[tone])}>
      <Icon aria-hidden="true" className="h-3 w-3" />
      {children}
    </span>
  );
}