"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DOCTOR_NAVIGATION } from "@/lib/doctor-navigation";

export function DoctorSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    practice: true,
    clinical: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="h-10 w-10"
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:relative inset-0 md:inset-auto z-40 w-64 bg-background border-r border-border transition-transform duration-300 md:translate-x-0 overflow-y-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="space-y-2 p-4 mt-16 md:mt-0">
          {/* Navigation Sections */}
          {Object.entries(DOCTOR_NAVIGATION).map(([key, section]) => (
            <div key={key} className="space-y-1">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(key)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors"
              >
                <span>{section.label}</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform duration-200",
                    expandedSections[key] ? "rotate-0" : "-rotate-90"
                  )}
                />
              </button>

              {/* Section Items */}
              {expandedSections[key] && (
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                          active
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                        title={item.description}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                        )}

                        {/* Tooltip on hover */}
                        <div className="hidden group-hover:block absolute left-full ml-2 px-2 py-1 bg-popover border border-border rounded text-xs whitespace-nowrap z-50">
                          {item.description}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
