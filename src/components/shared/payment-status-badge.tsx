import { Badge } from "@/components/ui/badge";

const LABEL: Record<string, { text: string; variant: "success" | "warning" | "destructive" | "secondary" | "outline" }> = {
  PENDING: { text: "Awaiting payment", variant: "warning" },
  SUCCESSFUL: { text: "Paid", variant: "success" },
  FAILED: { text: "Payment failed", variant: "destructive" },
  REFUND_PENDING: { text: "Refund in progress", variant: "warning" },
  REFUNDED: { text: "Refunded", variant: "secondary" },
  CANCELLED: { text: "Cancelled", variant: "outline" },
};

export function PaymentStatusBadge({ status }: { status: string }) {
  const { text, variant } = LABEL[status] ?? { text: status, variant: "outline" as const };
  return (
    <Badge variant={variant} className="rounded-lg text-xs">
      {text}
    </Badge>
  );
}
