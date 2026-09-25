"use client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  accent?: "yellow" | "teal" | "green" | "purple" | "pink" | "orange";
  subtitle?: string;
  className?: string;
}

const accentStyles = {
  yellow: { bg: "bg-primary/10", text: "text-primary", glow: "neon-glow-yellow" },
  teal: { bg: "bg-secondary/10", text: "text-secondary", glow: "neon-glow-teal" },
  green: { bg: "bg-green-500/10", text: "text-green-400" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-400" },
  pink: { bg: "bg-pink-500/10", text: "text-pink-400" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-400" },
};

export function StatTile({ icon: Icon, label, value, accent = "yellow", subtitle, className }: StatTileProps) {
  const style = accentStyles[accent];
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="font-display text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", style.bg, style.text)}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
