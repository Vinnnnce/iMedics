"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { SPECIALTIES, filterSpecialties } from "@/lib/home/content";

export function SpecialtyGrid() {
  const [term, setTerm] = useState("");
  const visible = filterSpecialties(SPECIALTIES, term);

  return (
    <div className="space-y-4">
      <div className="ai-search-bar flex items-center gap-2 px-4 py-2">
        <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="search"
          value={term}
          onChange={event => setTerm(event.target.value)}
          aria-label="Search specialties"
          placeholder="Search specialties, e.g. cardiology"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded-sm"
        />
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {visible.length} of {SPECIALTIES.length} specialties shown
      </p>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {visible.map(specialty => (
          <li key={specialty.name}>
            <Link
              href={`/doctors?q=${encodeURIComponent(specialty.query)}`}
              className="beeline-card beeline-tile flex h-full items-center p-4 text-sm font-medium"
            >
              {specialty.name}
            </Link>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="col-span-full rounded-lg border border-border p-6 text-center text-sm text-muted-foreground" role="status">
            No specialties match &ldquo;{term}&rdquo;. Try a shorter search term.
          </li>
        )}
      </ul>
    </div>
  );
}