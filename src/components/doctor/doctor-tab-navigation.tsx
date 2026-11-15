"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DOCTOR_NAVIGATION } from "@/lib/doctor-navigation";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export function DoctorTabNavigation() {
  const pathname = usePathname();

  const isInSection = (sectionKey: string): boolean => {
    const section = DOCTOR_NAVIGATION[sectionKey];
    if (!section) return false;
    return section.items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
  };

  const mainSections = [
    { key: "practice", label: "Practice", icon: "🏥" },
    { key: "clinical", label: "Clinical", icon: "💼" },
    { key: "management", label: "Management", icon: "⚙️" },
    { key: "profile", label: "Profile", icon: "👤" },
    { key: "account", label: "Account", icon: "⚙️" },
  ];

  return (
    <ScrollArea className="w-full border-t border-border bg-background md:hidden">
      <div className="flex gap-1 p-2">
        {mainSections.map(({ key, label }) => {
          const active = isInSection(key);
          const firstItem = DOCTOR_NAVIGATION[key]?.items[0];

          if (!firstItem) return null;

          return (
            <Link
              key={key}
              href={firstItem.href}
              className={cn(
                "flex-shrink-0 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
