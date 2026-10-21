"use client";

import { useState } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface FacilityTemplateRow {
  id: string;
  name: string;
  kind: "LAB_REPORT" | "REFERRAL_FORM" | "CASE_NOTE" | "IMAGING_REPORT";
  content: string;
  updatedAt: string;
  createdBy: string;
}

const KINDS: { value: FacilityTemplateRow["kind"]; label: string; example: string }[] = [
  {
    value: "LAB_REPORT",
    label: "Lab report",
    example: '{\n  "accession": "Lab no. …",\n  "referredBy": "Referred by …",\n  "specimen": "Specimen …",\n  "findings": "Findings: …",\n  "conclusion": "Conclusion …"\n}',
  },
  {
    value: "REFERRAL_FORM",
    label: "Referral form",
    example: '{\n  "reason": "Reason for referral …",\n  "clinicalSummary": "Clinical summary …",\n  "urgency": "Urgency …"\n}',
  },
  {
    value: "CASE_NOTE",
    label: "Case note",
    example: '{\n  "history": "History …",\n  "examination": "Examination …",\n  "assessment": "Assessment …",\n  "plan": "Plan …"\n}',
  },
  {
    value: "IMAGING_REPORT",
    label: "Imaging report",
    example: '{\n  "technique": "Technique …",\n  "findings": "Findings …",\n  "impression": "Impression …"\n}',
  },
];

/**
 * CRUD manager for the facility's document templates. Content is a JSON
 * object of scaffold fields — validated client and server side.
 */
export function FacilityTemplateManager({ templates }: { templates: FacilityTemplateRow[] }) {
  const [rows, setRows] = useState(templates);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<FacilityTemplateRow["kind"]>("LAB_REPORT");
  const [content, setContent] = useState(KINDS[0].example);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const res = await fetch("/api/facility/document-templates");
    if (res.ok) {
      const data = await res.json();
      setRows(data.templates ?? []);
    }
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      JSON.parse(content); // shape checked again server-side
    } catch {
      setError("Content must be valid JSON (an object of scaffold fields)");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/facility/document-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), kind, content }),
      });
      if (!res.ok) throw new Error();
      setName("");
      await refresh();
    } catch {
      setError("Could not save the template");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this template?")) return;
    try {
      const res = await fetch(`/api/facility/document-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setRows(prev => prev.filter(t => t.id !== id));
    } catch {
      setError("Could not delete the template");
    }
  };

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive" role="alert" data-testid="text-template-error">{error}</p>}

      <section className="rounded-xl border border-border bg-card p-4" aria-labelledby="new-template-heading">
        <h2 id="new-template-heading" className="text-sm font-semibold">New template</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Standard full blood count report"
              maxLength={80}
              data-testid="input-template-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-kind">Document type</Label>
            <select
              id="template-kind"
              value={kind}
              onChange={e => {
                const next = e.target.value as FacilityTemplateRow["kind"];
                setKind(next);
                const preset = KINDS.find(k => k.value === next);
                if (preset) setContent(preset.example);
              }}
              className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm"
              data-testid="select-template-kind"
            >
              {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <Label htmlFor="template-content">Scaffold fields (JSON)</Label>
          <textarea
            id="template-content"
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={7}
            className="w-full rounded-lg border border-input bg-background p-2 font-mono text-xs"
            data-testid="input-template-content"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button type="button" onClick={() => void create()} disabled={busy || !name.trim()} data-testid="button-create-template">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            Save template
          </Button>
        </div>
      </section>

      <section aria-labelledby="existing-templates-heading">
        <h2 id="existing-templates-heading" className="text-sm font-semibold">
          Existing templates {rows.length > 0 && <span className="text-muted-foreground">({rows.length})</span>}
        </h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground" data-testid="text-no-templates">
            No templates yet — create the first one above.
          </p>
        ) : (
          <ul className="mt-2 space-y-2" data-testid="list-templates">
            {rows.map(template => (
              <li key={template.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{template.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {KINDS.find(k => k.value === template.kind)?.label ?? template.kind} · by {template.createdBy}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void remove(template.id)}
                  aria-label={`Delete ${template.name}`}
                  data-testid={`button-delete-template-${template.id}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
