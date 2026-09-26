"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Sun, Moon, Menu } from "lucide-react";
import {
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { useState } from "react";
import { Sidebar } from "./sidebar";

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useUser();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const role = ((user?.publicMetadata as Record<string, unknown>)?.role as string) ||
    ((user?.unsafeMetadata as Record<string, unknown>)?.role as string) || "PATIENT";

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          {/* Brand + mobile menu */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary neon-glow">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v20M2 12h20" strokeLinecap="round" />
                </svg>
              </div>
              <span className="text-lg font-bold tracking-tight text-primary neon-text hidden sm:inline">
                Medic1905
              </span>
            </div>
          </div>

          {/* User menu + theme toggle */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            <Show when="signed-out">
              <div className="flex items-center gap-2">
                <SignInButton>
                  <Button variant="ghost" size="sm">Sign In</Button>
                </SignInButton>
                <SignUpButton>
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 neon-glow">Sign Up</Button>
                </SignUpButton>
              </div>
            </Show>

            <Show when="signed-in">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-9 w-9 rounded-xl",
                  },
                }}
              />
            </Show>
          </div>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar border-r border-border overflow-y-auto">
            <Sidebar />
          </div>
        </div>
      )}
    </>
  );
}
