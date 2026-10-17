"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CONSULTATION_TEMPLATES } from "@/lib/consultation-templates";
export function ConsultationTemplatePicker({ onApply }: { onApply: (value: { history: string; examination: string; notes: string }) => void }) {
  const [selected, setSelected] = useState<keyof typeof CONSULTATION_TEMPLATES>("general");
  return <div className="space-y-3 rounded-xl border border-border bg-card p-4">
    <label className="block space-y-2 text-sm">Consultation template<select aria-label="Consultation template" className="block h-10 w-full rounded-lg border border-input bg-background px-2" value={selected} onChange={event => setSelected(event.target.value as keyof typeof CONSULTATION_TEMPLATES)}>
      {Object.entries(CONSULTATION_TEMPLATES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
    </select></label>
    <p className="text-xs text-muted-foreground">Scaffolding only. No findings, diagnosis, medication, or clinical decisions are generated.</p>
    <Button variant="outline" type="button" onClick={() => {
      if (window.confirm("Replace history, examination, and additional notes with this blank template? Other fields will be retained.")) onApply(CONSULTATION_TEMPLATES[selected]);
    }}>Apply documentation template</Button>
  </div>;
}
