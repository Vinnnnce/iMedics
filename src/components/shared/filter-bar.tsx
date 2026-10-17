"use client";
import { useId, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function FilterBar({ search, onSearchChange, searchLabel = "Search records", from, to, onDateChange, children }: {
  search: string; onSearchChange: (value: string) => void; searchLabel?: string;
  from?: string; to?: string; onDateChange?: (range: { from: string; to: string }) => void;
  children?: ReactNode;
}) {
  const id = useId();
  return <div role="search" aria-label="Filter records" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
    <div className="min-w-0 flex-1 space-y-2"><Label htmlFor={`${id}-search`}>{searchLabel}</Label>
      <Input id={`${id}-search`} type="search" value={search} onChange={event => onSearchChange(event.target.value)} autoComplete="off" />
    </div>
    {onDateChange && <div className="grid grid-cols-2 gap-3 sm:flex">
      <div className="space-y-2"><Label htmlFor={`${id}-from`}>From date</Label><Input id={`${id}-from`} type="date" value={from ?? ""} max={to || undefined} onChange={event => onDateChange({ from: event.target.value, to: to ?? "" })} /></div>
      <div className="space-y-2"><Label htmlFor={`${id}-to`}>To date</Label><Input id={`${id}-to`} type="date" value={to ?? ""} min={from || undefined} onChange={event => onDateChange({ from: from ?? "", to: event.target.value })} /></div>
    </div>}
    {children}
  </div>;
}
