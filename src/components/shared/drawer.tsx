"use client";

import { useRef, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Uses the existing dialog primitive for focus trapping, Escape, and focus restoration. */
export function Drawer({ open, onOpenChange, title, children, id, className }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string;
  children: ReactNode; id?: string; className?: string;
}) {
  const previousFocus = useRef<HTMLElement | null>(null);
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className={cn("fixed inset-0 z-[60] bg-black/50", className)} />
      <Dialog.Content id={id} aria-describedby={undefined}
        onOpenAutoFocus={() => { previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
        onCloseAutoFocus={event => { event.preventDefault(); previousFocus.current?.focus(); }}
        className={cn("fixed inset-y-0 left-0 z-[61] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto border-r border-border bg-sidebar", className)}>
        <Dialog.Title className="sr-only">{title}</Dialog.Title>
        {children}
        <Dialog.Close aria-label="Close navigation" className="absolute right-3 top-5 rounded-lg p-1 text-muted-foreground hover:bg-muted">
          <X aria-hidden="true" className="h-5 w-5" />
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
