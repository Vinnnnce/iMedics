import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { withParams } from "@/lib/admin/params";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, href, tone }: { label: string; value: ReactNode; hint?: ReactNode; href?: string; tone?: "warning" | "danger" }) {
  const body = (
    <Card className={cn("beeline-card h-full transition-colors", href && "hover:bg-muted/40", tone === "warning" && "border-warning/50", tone === "danger" && "border-destructive/50")}>
      <CardContent className="space-y-1 p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

/** A dependency-free bar chart. Each bar has a text label for hover and for screen readers. */
export function BarChart({ data, label, format = (n) => String(n) }: { data: { day: string; value: number }[]; label: string; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((a, d) => a + d.value, 0);
  const w = 300;
  const h = 72;
  const gap = 2;
  const bar = (w - gap * (data.length - 1)) / data.length;
  return (
    <figure className="space-y-2">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{format(total)} in {data.length} days</span>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full" role="img" aria-label={`${label}: ${format(total)} in the last ${data.length} days`} preserveAspectRatio="none">
        {data.map((d, i) => {
          const barH = d.value === 0 ? 1.5 : Math.max(3, (d.value / max) * (h - 4));
          return (
            <rect key={d.day} x={i * (bar + gap)} y={h - barH} width={bar} height={barH} rx={1.5} className={d.value === 0 ? "fill-muted" : "fill-foreground"}>
              <title>{`${d.day}: ${format(d.value)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0]?.day.slice(5)}</span>
        <span>{data.at(-1)?.day.slice(5)}</span>
      </div>
    </figure>
  );
}

export function Pagination({ base, params, page, pageCount, total, pageSize }: { base: string; params: Record<string, string | undefined>; page: number; pageCount: number; total: number; pageSize: number }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const link = (p: number) => withParams(base, params, { page: p > 1 ? String(p) : undefined });
  const btn = "inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-sm";
  return (
    <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Pagination">
      <p className="text-muted-foreground">
        {from}–{to} of {total.toLocaleString()}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={link(page - 1)} className={cn(btn, "hover:bg-muted")}>
            <ChevronLeft className="h-4 w-4" /> Previous
          </Link>
        ) : (
          <span className={cn(btn, "opacity-40")}>
            <ChevronLeft className="h-4 w-4" /> Previous
          </span>
        )}
        {page < pageCount ? (
          <Link href={link(page + 1)} className={cn(btn, "hover:bg-muted")}>
            Next <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className={cn(btn, "opacity-40")}>
            Next <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </nav>
  );
}

const USER_STATUS = { ACTIVE: ["success", "Active"], PENDING: ["warning", "Pending"], SUSPENDED: ["destructive", "Suspended"], BANNED: ["destructive", "Banned"] } as const;
export function UserStatusBadge({ status }: { status: string }) {
  const [variant, text] = USER_STATUS[status as keyof typeof USER_STATUS] ?? (["outline", status] as const);
  return <Badge variant={variant} className="rounded-lg text-xs">{text}</Badge>;
}

const VERIFICATION = { PENDING: ["warning", "Awaiting review"], VERIFIED: ["success", "Verified"], REJECTED: ["destructive", "Changes requested"] } as const;
export function VerificationBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const [variant, text] = VERIFICATION[status as keyof typeof VERIFICATION] ?? (["outline", status] as const);
  return <Badge variant={variant} className="rounded-lg text-xs">{text}</Badge>;
}

export const ROLE_LABEL: Record<string, string> = { PATIENT: "Patient", DOCTOR: "Doctor", LAB_SCIENTIST: "Facility", ADMIN: "Administrator" };
export const TYPE_LABEL: Record<string, string> = { PATIENT: "Patient", DOCTOR: "Doctor", LABORATORY: "Laboratory", DIAGNOSTIC_CENTRE: "Diagnostic centre", HOSPITAL: "Hospital", PHARMACY: "Pharmacy" };

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export const selectClass = "h-9 rounded-lg border border-input bg-background px-2 text-sm";
export const inputClass = "h-9 rounded-lg border border-input bg-background px-3 text-sm";

/** "3 days ago", "just now": relative age for queues. */
export function ago(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
