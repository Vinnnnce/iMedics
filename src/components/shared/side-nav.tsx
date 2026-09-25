"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Stethoscope, Users, FlaskConical, Activity, LayoutDashboard, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/lab-tests", label: "Lab Tests", icon: FlaskConical },
  { href: "/diagnostics", label: "Diagnostics", icon: Activity },
];

export function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex fixed left-0 top-0 z-40 h-screen w-72 flex-col border-r border-border bg-card/50 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl neon-gradient">
          <span className="font-display text-xl font-extrabold text-navy">M</span>
        </div>
        <div>
          <h1 className="font-display text-lg font-bold tracking-tight">Medic1905</h1>
          <p className="text-xs text-muted-foreground">Telemedicine Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all duration-200",
                isActive
                  ? "bg-primary/15 text-primary neon-glow-yellow"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="p-3">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
