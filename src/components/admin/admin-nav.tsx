"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ADMIN_LINKS } from "@/components/admin/admin-links";

export function AdminNav({ pending }: { pending: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const links = (mobile: boolean) => (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {ADMIN_LINKS.map(({ href, label, icon: Icon, exact, badge }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={href} title={label} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
          className={cn("flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors", active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
          <Icon className="size-4 shrink-0" /><span className={!mobile && collapsed ? "sr-only" : ""}>{label}</span>
          {badge && pending > 0 && !collapsed && <span className="ml-auto rounded-full bg-muted px-2 py-1 text-xs text-foreground">{pending}</span>}
        </Link>;
      })}
    </nav>
  );
  return (
    <>
      <Button variant="outline" className="w-full justify-start lg:hidden" onClick={() => setOpen(true)} aria-expanded={open}><Menu className="mr-2 size-4" />Administration navigation</Button>
      <div className="hidden lg:block"><div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{collapsed ? "Admin" : "Control centre"}</p><Button variant="ghost" aria-label="Collapse administration sidebar" aria-pressed={collapsed} onClick={() => setCollapsed(!collapsed)}><PanelLeftClose className="size-4" /></Button></div>{links(false)}</div>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="left-0 top-0 h-dvh max-h-dvh w-[min(22rem,90vw)] translate-x-0 translate-y-0 overflow-y-auto rounded-none"><DialogHeader><DialogTitle>Administration</DialogTitle></DialogHeader>{links(true)}</DialogContent></Dialog>
    </>
  );
}
