"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ADMIN_LINKS } from "@/components/admin/admin-links";

export function AdminNav({ pending }: { pending: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {ADMIN_LINKS.map(({ href, label, icon: Icon, exact, badge }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors", active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            {badge && pending > 0 && (
              <span className={cn("ml-auto rounded-full px-1.5 text-[10px] font-bold", active ? "bg-background text-foreground" : "bg-destructive text-white")}>{pending}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
