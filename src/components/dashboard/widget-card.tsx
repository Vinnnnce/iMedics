import type { ReactNode } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import type { LucideIcon } from "lucide-react";

export interface WidgetCardProps {
  title: string;
  icon: LucideIcon;
  /** Status summary shown next to the title; never colour alone (chip includes icon + text). */
  status?: { tone: StatusTone; label: string };
  children: ReactNode;
  /** Single clear primary action for the widget. */
  action?: { href: string; label: string };
  /** Optional secondary, lower-emphasis action. */
  secondaryAction?: { href: string; label: string };
}

export function WidgetCard({ title, icon: Icon, status, children, action, secondaryAction }: WidgetCardProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {status && (
            <span className="ml-auto">
              <StatusChip tone={status.tone}>{status.label}</StatusChip>
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex-1">{children}</div>
        {action && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href={action.href}
              className="inline-flex items-center justify-center rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
            >
              {action.label}
            </Link>
            {secondaryAction && (
              <Link
                href={secondaryAction.href}
                className="inline-flex items-center justify-center rounded-md border border-input px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                {secondaryAction.label}
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}