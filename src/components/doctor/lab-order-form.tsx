"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";

interface Props {
  patients: { id: string; name: string; caseNumber: string }[];
  tests: { code: string; name: string; category: string }[];
}

const field = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm";

export function LabOrderForm({ patients, tests }: Props) {
  const router = useRouter();
  const [patientId, setPatientId] = useState("");
  const [priority, setPriority] = useState<"ROUTINE" | "URGENT" | "STAT">("ROUTINE");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const map = new Map<string, Props["tests"]>();
    for (const t of tests) {
      if (q && !`${t.name} ${t.code}`.toLowerCase().includes(q)) continue;
      map.set(t.category, [...(map.get(t.category) ?? []), t]);
    }
    return [...map.entries()];
  }, [tests, filter]);

  const toggle = (code: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const submit = () =>
    startTransition(async () => {
      setMessage(null);
      try {
        await apiClient.post("/lab-orders", { patientId, priority, clinicalNotes: notes || undefined, testCodes: [...selected] });
        setMessage({ type: "ok", text: "Lab order sent." });
        setSelected(new Set());
        setNotes("");
        router.refresh();
      } catch (e) {
        setMessage({ type: "error", text: e instanceof Error ? e.message : "Could not send the order" });
      }
    });

  return (
    <Card className="beeline-card">
      <CardHeader>
        <CardTitle className="text-lg">New lab request</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            Patient
            <select className={`${field} mt-1`} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Select a patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.caseNumber}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Priority
            <select className={`${field} mt-1`} value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
              <option value="ROUTINE">Routine</option>
              <option value="URGENT">Urgent</option>
              <option value="STAT">STAT (immediately)</option>
            </select>
          </label>
        </div>

        <div className="space-y-2">
          <input className={field} placeholder="Search tests…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-border p-3">
            {grouped.map(([category, items]) => (
              <div key={category}>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">{category}</p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {items.map((t) => (
                    <label key={t.code} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={selected.has(t.code)} onChange={() => toggle(t.code)} />
                      {t.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {grouped.length === 0 && <p className="text-sm text-muted-foreground">No tests match.</p>}
          </div>
          <p className="text-xs text-muted-foreground">{selected.size} selected</p>
        </div>

        <textarea className="min-h-20 w-full rounded-lg border border-input bg-background p-2 text-sm" maxLength={2000} placeholder="Clinical notes for the laboratory (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="flex items-center gap-3">
          <Button className="bg-foreground text-background rounded-lg" disabled={pending || !patientId || selected.size === 0} onClick={submit}>
            {pending ? "Sending…" : "Send request"}
          </Button>
          {message && <p className={`text-sm ${message.type === "ok" ? "text-muted-foreground" : "text-destructive"}`}>{message.text}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
