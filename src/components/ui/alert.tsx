import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative grid w-full gap-0.5 rounded-lg border px-3 py-2.5 text-left text-sm has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 [&>svg]:size-4 [&>svg]:translate-y-0.5",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive: "border-destructive/30 bg-destructive/5 text-destructive [&>svg]:text-destructive",
        warning: "border-warning/30 bg-warning/5 text-foreground [&>svg]:text-warning",
        success: "border-success/30 bg-success/5 text-foreground [&>svg]:text-success",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("col-start-2 font-medium leading-snug", className)} {...props} />
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-description" className={cn("col-start-2 text-sm text-muted-foreground", className)} {...props} />
}

export { Alert, AlertTitle, AlertDescription }
