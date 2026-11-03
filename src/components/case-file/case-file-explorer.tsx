"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownUp, BedDouble, ChevronRight, FileText, FlaskConical, Folder,
  FolderOpen, HeartPulse, MessageSquare, Search, ShieldAlert, Skull, Sparkles,
  Stethoscope, UserRound, X,
} from "lucide-react";
import { CASE_FILE_FOLDERS, folderTitle, type CaseFileFolderKey } from "@/lib/case-file/folders";

export type CaseFileStatusTone = "draft" | "pending" | "final" | "amended";

export interface CaseFileEntry {
  id: string;
  /** Logical type — used only for icons, never for access decisions. */
  kind: "document" | "lab" | "consultation" | "prescription" | "media" | "referral" | "admission";
  title: string;
  folder: CaseFileFolderKey;
  statusLabel: string;
  statusTone: CaseFileStatusTone;
  author?: string;
  department?: string;
  encounter?: string;
  /** ISO date shown and used for sorting. */
  date: string;
  /** Opens the document preview where the viewer is authorised. */
  href?: string;
  /** PDF download / print, only where the viewer is authorised. */
  pdfHref?: string;
}

const FOLDER_ICONS: Record<CaseFileFolderKey, typeof Folder> = {
  assessments: Stethoscope,
  summaries: FileText,
  oncology: Sparkles,
  surgical: HeartPulse,
  consent: FileText,
  laboratory: FlaskConical,
  radiology: MessageSquare,
  transfusion: HeartPulse,
  admissions: BedDouble,
  safety: ShieldAlert,
  mortality: Skull,
  other: FolderOpen,
};

const KIND_ICONS: Record<CaseFileEntry["kind"], typeof Folder> = {
  document: FileText,
  lab: FlaskConical,
  consultation: Stethoscope,
  prescription: FileText,
  media: MessageSquare,
  referral: ChevronRight,
  admission: BedDouble,
};

const TONE_CLASSES: Record<CaseFileStatusTone, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-warning/15 text-warning",
  final: "bg-success/15 text-success",
  amended: "bg-accent text-accent-foreground",
};

function StatusBadge({ tone, label }: { tone: CaseFileStatusTone; label: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[tone]}`}>
      {label}
    </span>
  );
}

function formatEntryDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * The organised case-file experience shared by the patient and professional
 * views: the twelve document folders from the case-file reference, a folder
 * grid with live counts, and a searchable, filterable, sortable document list.
 *
 * The component receives already-access-checked entries — it never queries or
 * exposes anything the calling server page did not authorise.
 */
export function CaseFileExplorer({ entries, viewLabel }: { entries: CaseFileEntry[]; viewLabel: string }) {
  const [folder, setFolder] = useState<CaseFileFolderKey | "all">("all");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [year, setYear] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const departments = useMemo(() => {
    const set = new Set(entries.map((e) => e.department).filter((d): d is string => Boolean(d)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const years = useMemo(() => {
    const set = new Set(entries.map((e) => new Date(e.date).getFullYear()).filter((y) => !Number.isNaN(y)));
    return Array.from(set).sort((a, b) => b - a);
  }, [entries]);

  const counts = useMemo(() => {
    const map = new Map<CaseFileFolderKey, number>();
    for (const entry of entries) map.set(entry.folder, (map.get(entry.folder) ?? 0) + 1);
    return map;
  }, [entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      if (folder !== "all" && entry.folder !== folder) return false;
      if (department !== "all" && entry.department !== department) return false;
      if (year !== "all" && String(new Date(entry.date).getFullYear()) !== year) return false;
      if (!q) return true;
      return [entry.title, entry.author, entry.department, entry.encounter, entry.statusLabel]
        .filter((v): v is string => Boolean(v))
        .some((v) => v.toLowerCase().includes(q));
    });
    return filtered.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return sort === "newest" ? db - da : da - db;
    });
  }, [entries, folder, department, year, query, sort]);

  const activeFilters = folder !== "all" || department !== "all" || year !== "all" || query.trim() !== "";

  return (
    <section aria-labelledby="case-folders-heading" data-testid="case-file-explorer">
      <div className="flex items-center justify-between gap-3">
        <h2 id="case-folders-heading" className="text-lg font-semibold">
          Case-file folders
        </h2>
        <p className="text-xs text-muted-foreground">{viewLabel}</p>
      </div>

      {/* Folder grid — the twelve organised folders from the case-file reference. */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {CASE_FILE_FOLDERS.map((f) => {
          const Icon = FOLDER_ICONS[f.key];
          const count = counts.get(f.key) ?? 0;
          const selected = folder === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFolder(selected ? "all" : f.key)}
              aria-pressed={selected}
              data-testid={`button-folder-${f.key}`}
              className={`beeline-tile flex items-start gap-3 border p-4 text-left transition-colors ${
                selected ? "border-primary bg-accent" : "border-border bg-card hover:border-foreground/40"
              } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted" aria-hidden="true">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{f.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {count} {count === 1 ? "document" : "documents"}
                </span>
              </span>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {/* Search, filters and sort */}
      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center md:flex-wrap">
        <div className="relative flex-1 md:min-w-56">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents, authors, departments…"
            aria-label="Search case-file documents"
            data-testid="input-case-search"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </div>
        <select
          value={folder}
          onChange={(e) => setFolder(e.target.value as CaseFileFolderKey | "all")}
          aria-label="Filter by folder"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All folders</option>
          {CASE_FILE_FOLDERS.map((f) => (
            <option key={f.key} value={f.key}>{f.title}</option>
          ))}
        </select>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          aria-label="Filter by department"
          disabled={departments.length === 0}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          aria-label="Filter by year"
          disabled={years.length === 0}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="all">All dates</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <ArrowDownUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
            aria-label="Sort documents"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
        {activeFilters && (
          <button
            type="button"
            onClick={() => { setFolder("all"); setQuery(""); setDepartment("all"); setYear("all"); }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" /> Clear filters
          </button>
        )}
      </div>

      {/* Document list */}
      <div className="mt-4" aria-live="polite">
        <p className="text-xs text-muted-foreground" data-testid="text-case-count">
          {visible.length} of {entries.length} documents shown
          {folder !== "all" ? ` in ${folderTitle(folder as CaseFileFolderKey)}` : ""}
        </p>
        {visible.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-border p-8 text-center">
            <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium">No documents match</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {entries.length === 0
                ? "Documents appear here once they are created and, in the patient view, released for you."
                : "Try clearing the search or filters."}
            </p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
            {visible.map((entry) => {
              const Icon = KIND_ICONS[entry.kind];
              return (
                <li key={`${entry.kind}-${entry.id}`} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between" data-testid={`row-case-entry-${entry.id}`}>
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted" aria-hidden="true">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      {entry.href ? (
                        <Link href={entry.href} className="truncate text-sm font-medium hover:underline">
                          {entry.title}
                        </Link>
                      ) : (
                        <p className="truncate text-sm font-medium">{entry.title}</p>
                      )}
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><UserRound className="h-3 w-3" aria-hidden="true" />{entry.author ?? "—"}</span>
                        {entry.department && <span>{entry.department}</span>}
                        {entry.encounter && <span>Encounter {entry.encounter}</span>}
                        <span>{formatEntryDate(entry.date)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge tone={entry.statusTone} label={entry.statusLabel} />
                    {entry.href && !entry.pdfHref && (
                      <Link href={entry.href} className="text-xs font-medium text-primary hover:underline">Open</Link>
                    )}
                    {entry.pdfHref && (
                      <a
                        href={entry.pdfHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        Open & print
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
