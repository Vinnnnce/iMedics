"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type DocumentTemplate = { id: string; name: string; kind: string; content: string };

/**
 * Normalize a template key or field name for matching: lowercase, letters and
 * digits only. "Medication Instructions" and "medicationInstructions" both
 * normalize to "medicationinstructions".
 */
function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Apply a template's scaffold to a set of form fields. Template content is a
 * JSON object of free-form keys to text scaffolds. Keys are matched to field
 * names case- and punctuation-insensitively in both directions (a "findings"
 * key fills "preliminaryFindings"); unmatched keys are appended to the
 * designated primary field as labelled sections so nothing in the template
 * is silently lost.
 */
export function applyTemplateToFields(
  content: string,
  fields: Record<string, string>,
  primaryField: string,
): Record<string, string> {
  let scaffold: Record<string, unknown>;
  try {
    scaffold = JSON.parse(content) as Record<string, unknown>;
    if (!scaffold || typeof scaffold !== "object" || Array.isArray(scaffold)) {
      return fields;
    }
  } catch {
    return fields;
  }

  const next = { ...fields };
  const matchedKeys = new Set<string>();
  const unmatched: { key: string; value: string }[] = [];

  for (const [key, value] of Object.entries(scaffold)) {
    if (typeof value !== "string" || !value.trim()) continue;
    const normalizedKey = normalizeKey(key);
    const target = Object.keys(fields).find((fieldName) => {
      const normalizedField = normalizeKey(fieldName);
      return (
        normalizedField === normalizedKey ||
        normalizedField.includes(normalizedKey) ||
        normalizedKey.includes(normalizedField)
      );
    });
    if (target) {
      next[target] = value;
      matchedKeys.add(key);
    } else {
      unmatched.push({ key, value });
    }
  }

  if (unmatched.length > 0) {
    const extra = unmatched
      .map((u) => `${u.key}:\n${u.value}`)
      .join("\n\n");
    next[primaryField] = next[primaryField]?.trim()
      ? `${next[primaryField].trim()}\n\n${extra}`
      : extra;
  }

  return next;
}

/**
 * Facility document template picker for report creation forms. Loads the
 * facility's saved templates of the given kind; choosing one pre-fills the
 * form's fields via the scaffold matcher above.
 */
export function TemplatePicker({
  kind,
  onApply,
}: {
  kind: string;
  onApply: (content: string) => void;
}) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    fetch(`/api/facility/document-templates?kind=${encodeURIComponent(kind)}`)
      .then((r) => r.json())
      .then((d) => {
        setTemplates(d.templates ?? []);
        setLoaded(true);
      })
      .catch(() => undefined);
  }, [open, loaded, kind]);

  if (loaded && templates.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Select
        value={null}
        onOpenChange={(o) => setOpen(o ?? false)}
        onValueChange={(value) => {
          if (typeof value !== "string") return;
          const template = templates.find((t) => t.id === value);
          if (template) onApply(template.content);
        }}
      >
        <SelectTrigger className="h-8 w-56 text-xs">
          <SelectValue placeholder={loaded ? "Start from a template…" : "Loading templates…"} />
        </SelectTrigger>
        <SelectContent>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!loaded && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
