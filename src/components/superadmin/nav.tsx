"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Users, UsersRound, KeyRound, ClipboardCheck, Building2, Stethoscope,
  ShieldCheck, FileText, UserRound, HeartPulse, BriefcaseMedical, Microscope, Scan, Pill,
  Blocks, CreditCard, Bot, Plug, BarChart3, Siren, ScrollText, Database, Bell, Server,
  Settings, Menu, PanelLeftClose, ShieldPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CONSOLE_LINKS, CONSOLE_GROUPS, type ConsoleLink } from "@/lib/superadmin/sections";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Users, UsersRound, KeyRound, ClipboardCheck, Building2, Stethoscope,
  ShieldCheck, FileText, UserRound, HeartPulse, BriefcaseMedical, Microscope, Scan, Pill,
  Blocks, CreditCard, Bot, Plug, BarChart3, Siren, ScrollText, Database, Bell, Server, Settings,
};

export function ConsoleNav({ allowedSections }: { allowedSections: string[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const visible = CONSOLE_LINKS.filter((l) => allowedSections.includes(l.section));
  const byGroup = CONSOLE_GROUPS.map((g) => ({ group: g, links: visible.filter((l) => l.group === g) })).filter((g) => g.links.length);

  const links = (mobile: boolean) => (
    <nav aria-label="Super Admin console" className="flex flex-col gap-4">
      {byGroup.map(({ group, links: groupLinks }) => (
        <div key={group} className="space-y-1">
          {!collapsed || mobile ? <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</p> : <div className="mx-3 border-b" />}
          {groupLinks.map(({ href, label, icon, exact }: ConsoleLink) => {
            const Icon = ICONS[icon] ?? LayoutDashboard;
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href} title={label} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                className={cn("flex min-h-10 min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <Icon className="size-4 shrink-0" />
                <span className={cn(!mobile && collapsed ? "sr-only" : "", "truncate")}>{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
      {!visible.length && <p className="px-3 text-xs text-muted-foreground">No console sections are assigned to your roles yet.</p>}
    </nav>
  );

  return (
    <>
      <Button variant="outline" className="w-full justify-start lg:hidden" onClick={() => setOpen(true)} aria-expanded={open}>
        <Menu className="mr-2 size-4" />Console navigation
      </Button>
      <div className="hidden lg:block">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldPlus className="size-4" />{collapsed ? "" : "Control Centre"}
          </p>
          <Button variant="ghost" aria-label="Collapse console sidebar" aria-pressed={collapsed} onClick={() => setCollapsed(!collapsed)}>
            <PanelLeftClose className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
          </Button>
        </div>
        {links(false)}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="left-0 top-0 h-dvh max-h-dvh w-[min(22rem,90vw)] translate-x-0 translate-y-0 overflow-y-auto rounded-none">
          <DialogHeader><DialogTitle>Super Admin Console</DialogTitle></DialogHeader>
          {links(true)}
        </DialogContent>
      </Dialog>
    </>
  );
}
