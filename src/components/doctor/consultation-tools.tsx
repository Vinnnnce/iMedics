"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONSULTATION_TEMPLATES } from "@/lib/consultation-templates";

export interface ConsultationScaffold {
  history: string;
  examination: string;
  notes: string;
}

interface SavedTemplate {
  id: string;
  name: string;
  content: string;
  updatedAt: string;
}

/**
 * Documentation template manager for the consultation form: apply the built-in
 * scaffolds or the clinician's saved templates, and save the current fields as
 * a new reusable template. Templates hold structure (field prompts) only —
 * never patient data.
 */
export function ConsultationTemplatePicker({
  onApply,
  getCurrent,
}: {
  onApply: (value: ConsultationScaffold) => void;
  getCurrent: () => ConsultationScaffold;
}) {
  const [saved, setSaved] = useState<SavedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("builtin:general");

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/note-templates?kind=CONSULTATION");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSaved(data.templates ?? []);
    } catch {
      setError("Could not load saved templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount: every setState inside loadTemplates runs after `await`,
    // so nothing updates synchronously within the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTemplates();
  }, [loadTemplates]);

  const apply = () => {
    if (selected.startsWith("builtin:")) {
      const key = selected.slice("builtin:".length) as keyof typeof CONSULTATION_TEMPLATES;
      const scaffold = CONSULTATION_TEMPLATES[key];
      if (!scaffold) return;
      if (
        window.confirm(
          "Replace history, examination, and additional notes with this blank template? Other fields will be retained.",
        )
      ) {
        onApply(scaffold);
      }
      return;
    }
    const template = saved.find(t => t.id === selected.slice("saved:".length));
    if (!template) return;
    try {
      const scaffold = JSON.parse(template.content) as ConsultationScaffold;
      if (
        window.confirm(
          "Replace history, examination, and additional notes with this template? Other fields will be retained.",
        )
      ) {
        onApply({
          history: scaffold.history ?? "",
          examination: scaffold.examination ?? "",
          notes: scaffold.notes ?? "",
        });
      }
    } catch {
      setError("That template could not be read");
    }
  };

  const saveCurrent = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the template a name first");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const current = getCurrent();
      const res = await fetch("/api/note-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          kind: "CONSULTATION",
          content: JSON.stringify({
            history: current.history,
            examination: current.examination,
            notes: current.notes,
          }),
        }),
      });
      if (!res.ok) throw new Error();
      setName("");
      await loadTemplates();
    } catch {
      setError("Could not save the template");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this saved template?")) return;
    try {
      const res = await fetch(`/api/note-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setSaved(prev => prev.filter(t => t.id !== id));
      if (selected === `saved:${id}`) setSelected("builtin:general");
    } catch {
      setError("Could not delete the template");
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4" data-testid="consultation-template-picker">
      <label className="block space-y-2 text-sm">
        Consultation template
        <select
          aria-label="Consultation template"
          className="block h-10 w-full rounded-lg border border-input bg-background px-2"
          value={selected}
          onChange={event => setSelected(event.target.value)}
          data-testid="select-consultation-template"
        >
          <optgroup label="Built-in">
            {Object.entries(CONSULTATION_TEMPLATES).map(([key, value]) => (
              <option key={key} value={`builtin:${key}`}>{value.label}</option>
            ))}
          </optgroup>
          {saved.length > 0 && (
            <optgroup label="Saved">
              {saved.map(template => (
                <option key={template.id} value={`saved:${template.id}`}>{template.name}</option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">
        Scaffolding only. No findings, diagnosis, medication, or clinical decisions are generated.
        {loading && " Loading saved templates…"}
      </p>
      {error && (
        <p className="text-xs text-destructive" data-testid="text-template-error" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" type="button" onClick={apply} data-testid="button-apply-template">
          Apply documentation template
        </Button>
        {selected.startsWith("saved:") && (
          <Button
            variant="ghost"
            type="button"
            aria-label="Delete selected template"
            onClick={() => void remove(selected.slice("saved:".length))}
            data-testid="button-delete-template"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
        <label className="flex-1 space-y-1 text-xs">
          Save current fields as a template
          <input
            type="text"
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="e.g. Paediatric follow-up"
            maxLength={80}
            className="block h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
            data-testid="input-template-name"
          />
        </label>
        <Button variant="outline" type="button" onClick={() => void saveCurrent()} disabled={saving} data-testid="button-save-template">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          Save template
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Templates hold structure (prompts and headings) — remove patient-specific details before saving.
      </p>
    </div>
  );
}
