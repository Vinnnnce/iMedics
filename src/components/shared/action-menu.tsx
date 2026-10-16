"use client";
import { Menu } from "@base-ui/react/menu";
import { MoreHorizontal } from "lucide-react";
export function ActionMenu({ label = "More actions", actions }: {
  label?: string; actions: readonly { id: string; label: string; onSelect: () => void; disabled?: boolean }[];
}) {
  return <Menu.Root>
    <Menu.Trigger aria-label={label} className="rounded-lg border border-border p-2 hover:bg-muted">
      <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
    </Menu.Trigger>
    <Menu.Portal><Menu.Positioner sideOffset={6} className="z-[70]">
      <Menu.Popup className="min-w-40 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg">
        {actions.map(action => <Menu.Item key={action.id} disabled={action.disabled} onClick={action.onSelect} className="cursor-default rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted data-[disabled]:opacity-50">{action.label}</Menu.Item>)}
      </Menu.Popup>
    </Menu.Positioner></Menu.Portal>
  </Menu.Root>;
}
