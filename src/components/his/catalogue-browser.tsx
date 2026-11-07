"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, inputClass } from "./use-api";

interface Group { code: string; title: string; items: { code: string; name: string; adoptedId: string | null }[] }

/** Searchable, expandable catalogue (groups A–P). Adopting clones the default into the hospital's own library. */
export function CatalogueBrowser({ groups, canManage }: { groups: Group[]; canManage: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filtered = useMemo(() => groups.map((g) => ({ ...g, items: g.items.filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase())) })).filter((g) => g.items.length), [groups, q]);
  return (
    <div className="space-y-2">
      <input className={inputClass} placeholder="Search document types…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search document types" data-testid="input-catalogue-search" />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {filtered.map((g) => {
        const isOpen = open[g.code] ?? Boolean(q);
        return (
          <div key={g.code} className="rounded-xl border bg-card">
            <button type="button" className="flex w-full items-center justify-between p-3 text-left text-sm font-semibold" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [g.code]: !isOpen }))}>
              <span>Group {g.code} — {g.title} <span className="font-normal text-muted-foreground">({g.items.length})</span></span>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {isOpen && (
              <ul className="divide-y border-t">
                {g.items.map((i) => (
                  <li key={i.code} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span>{i.name}</span>
                    {i.adoptedId ? (
                      <a href={`/lab/clinical-documents/templates/${i.adoptedId}`} className="text-xs text-primary hover:underline">Open</a>
                    ) : canManage ? (
                      <Button size="xs" variant="outline" disabled={busy === i.code} data-testid={`button-adopt-${i.code}`} onClick={async () => {
                        setBusy(i.code); setError(null);
                        try { const { template } = await api<{ template: { id: string } }>("/api/facility/his/templates", { body: { mode: "adopt", sourceCode: i.code } }); router.push(`/lab/clinical-documents/templates/${template.id}`); }
                        catch (e) { setError(e instanceof Error ? e.message : "Failed"); setBusy(null); }
                      }}>Adopt &amp; customize</Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
