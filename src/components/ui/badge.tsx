import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/15 text-primary",
        secondary: "border-transparent bg-secondary/15 text-secondary",
        destructive: "border-transparent bg-destructive/15 text-destructive",
        success: "border-transparent bg-green-500/15 text-green-400",
        warning: "border-transparent bg-yellow-500/15 text-yellow-400",
        outline: "text-foreground border-border",
        neon: "border-primary/30 bg-primary/10 text-primary neon-glow-yellow",
        teal: "border-secondary/30 bg-secondary/10 text-secondary",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
