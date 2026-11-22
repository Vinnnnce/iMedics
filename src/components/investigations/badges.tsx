import { AlertTriangle, CheckCircle2, CircleDashed, Clock, FileCheck2, FlaskConical, Hourglass, XCircle } from "lucide-react";
import type { InvestigationItemStatus, InvestigationPriority } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_LABEL, STATUS_LABEL, statusBucket } from "@/lib/investigations/constants";

type Variant = "default" | "secondary" | "destructive" | "outline" | "warning" | "success";

export function StatusBadge({ status }: { status: InvestigationItemStatus }) {
  const bucket = statusBucket(status);
  const variant: Variant = status === "SAMPLE_REJECTED" || bucket === "CANCELLED" ? "destructive" : bucket === "COMPLETED" ? "success" : bucket === "PENDING" ? "secondary" : status === "AWAITING_VERIFICATION" ? "warning" : "outline";
  const Icon = bucket === "COMPLETED" ? CheckCircle2 : bucket === "CANCELLED" ? XCircle : bucket === "PENDING" ? CircleDashed : status === "AWAITING_VERIFICATION" ? FileCheck2 : status.startsWith("SAMPLE") || status === "PROCESSING" ? FlaskConical : Hourglass;
  return (
    <Badge variant={variant} className="h-6 gap-1 px-2">
      <Icon aria-hidden /> {STATUS_LABEL[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: InvestigationPriority }) {
  if (priority === "ROUTINE") return <Badge variant="outline">{PRIORITY_LABEL[priority]}</Badge>;
  return (
    <Badge variant={priority === "EMERGENCY" ? "destructive" : "warning"}>
      {priority === "EMERGENCY" ? <AlertTriangle aria-hidden /> : <Clock aria-hidden />} {PRIORITY_LABEL[priority]}
    </Badge>
  );
}

export function FlagBadge({ flag }: { flag: string | null | undefined }) {
  if (!flag || flag === "NORMAL") return null;
  const critical = flag.startsWith("CRITICAL");
  const label = { LOW: "Low", HIGH: "High", CRITICAL_LOW: "Critical low", CRITICAL_HIGH: "Critical high" }[flag] ?? flag;
  return <Badge variant={critical ? "destructive" : "warning"}>{critical && <AlertTriangle aria-hidden />} {label}</Badge>;
}

export const fieldClass = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60";
