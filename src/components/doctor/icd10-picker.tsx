"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface Icd10Selection {
  code: string;
  description: string;
}

interface Props {
  value: Icd10Selection | null;
  onChange: (next: Icd10Selection | null) => void;
  disabled?: boolean;
}

/**
 * Searchable ICD-10 picker for the consultation's single diagnosis code.
 * Search by code ("I10", "e11.9") or by name ("hypertension"); picking a result replaces the selection.
 */
export function Icd10Picker({ value, onChange, disabled }: Props) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Icd10Selection[]>([]);
  const [releaseLabel, setReleaseLabel] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/icd10?q=${encodeURIComponent(q)}&limit=20`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Search failed");
        setHits(data.results);
        setReleaseLabel(data.release?.label ?? null);
        setError(data.release ? "" : "No ICD-10 code set has been imported yet.");
        setActive(0);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (hit: Icd10Selection) => {
    onChange({ code: hit.code, description: hit.description });
    setQuery("");
    setHits([]);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && hits[active]) {
      e.preventDefault();
      choose(hits[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && query.trim().length >= 2;

  return (
    <div ref={rootRef} className="space-y-2" data-testid="icd10-picker">
      {value && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm" aria-label="Selected diagnosis">
          <span className="font-mono font-semibold">{value.code}</span>
          <span className="flex-1 text-muted-foreground">{value.description}</span>
          <button type="button" onClick={() => onChange(null)} disabled={disabled} aria-label={`Remove ${value.code}`}>
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (e.target.value.trim().length < 2) {
              setHits([]);
              setError("");
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={value ? "Search to replace the selected code" : "Search by code or diagnosis, e.g. I10 or hypertension"}
          className="rounded-lg pl-9"
          data-testid="input-icd-search"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}

        {showList && (
          <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
            {error && <li className="px-3 py-2 text-sm text-destructive">{error}</li>}
            {!error && !loading && hits.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No matching diagnosis found.</li>}
            {hits.map((hit, i) => (
              <li
                key={hit.code}
                role="option"
                aria-selected={value?.code === hit.code}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(hit);
                }}
                className={cn("flex cursor-pointer items-start gap-2 rounded-md px-3 py-2 text-sm", i === active && "bg-muted")}
              >
                <span className="w-14 shrink-0 font-mono font-medium">{hit.code}</span>
                <span className="flex-1">{hit.description}</span>
              </li>
            ))}
            {releaseLabel && <li className="px-3 pb-1 pt-2 text-xs text-muted-foreground">{releaseLabel}</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
