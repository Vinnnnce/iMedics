"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary neon-glow">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v20M2 12h20" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight text-primary neon-text">
            Medic1905
          </span>
        </div>

        {/* Nav links */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <Link href="/documents" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Documents
          </Link>
          <Link href="/doctors" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Doctors
          </Link>
          <Link href="/appointments" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Appointments
          </Link>
        </nav>

        {/* User menu */}
        <div className="flex items-center gap-3">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-1 hover:bg-muted transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                    {user.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="text-sm">{user.name}</DropdownMenuItem>
                <DropdownMenuItem className="text-xs text-muted-foreground">{user.role}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <Link href="/profile"><DropdownMenuItem className="text-sm cursor-pointer">Profile &amp; Settings</DropdownMenuItem></Link>
                <Link href="/legal/privacy"><DropdownMenuItem className="text-sm cursor-pointer">Privacy Policy</DropdownMenuItem></Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive cursor-pointer" onClick={() => setUser(null)}>
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth/login">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link href="/auth/signup">
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 neon-glow">Sign Up</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
