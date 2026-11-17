"use client";

import { Bell, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface FacilityHeaderProps {
  facilityName: string;
  facilityType: string;
  totalStaff: number;
  activeServices: number;
  verificationStatus: string;
}

export function FacilityHeader({
  facilityName,
  facilityType,
  totalStaff,
  activeServices,
  verificationStatus,
}: FacilityHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-6">
        {/* Left: Facility Info */}
        <div className="hidden md:block min-w-0">
          <h1 className="text-lg font-semibold truncate">{facilityName}</h1>
          <p className="text-xs text-muted-foreground">{facilityType}</p>
        </div>

        {/* Center: Status Badges */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {verificationStatus === "VERIFIED" && (
            <Badge className="bg-green-100 text-green-800 hidden sm:inline-flex">✓ Verified</Badge>
          )}
          <Badge variant="outline" className="hidden sm:inline-flex">
            👥 {totalStaff} staff
          </Badge>
          <Badge variant="outline" className="hidden sm:inline-flex">
            📋 {activeServices} services
          </Badge>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium">Admin</p>
                  <p className="text-xs text-muted-foreground">Facility</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-xs font-semibold">⚙️</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-sm">
                <p className="font-medium">{facilityName}</p>
                <p className="text-xs text-muted-foreground">{facilityType}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/lab/organization" className="flex items-center gap-2 cursor-pointer">
                  <Settings className="h-4 w-4" />
                  <span>Organization Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/lab/staff-management" className="flex items-center gap-2 cursor-pointer">
                  <span>Staff Management</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/api/auth/logout" className="flex items-center gap-2 cursor-pointer text-destructive">
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
