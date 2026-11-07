"use client";

import { Download, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS, type DocumentCategory } from "@/lib/documents/shared";
import type { FacilityDocumentRow } from "@/lib/facility-documents";

export type { FacilityDocumentRow };

const SCOPES = [
  { value: "all", label: "All documents" },
  { value: "issued", label: "Issued by us" },
  { value: "shared", label: "Shared with us" },
] as const;
type Scope = (typeof SCOPES)[number]["value"];

/**
 * Patient documents a facility may read: the ones it issued and the ones
 * patients shared with it. Filters and "load more" run on the server (the list
 * is paginated), downloads go through the audited presigned-URL route, and
 * failures surface as a message.
 */
export function FacilityDocumentsTable({
  initialDocuments,
  initialCursor,
}: {
  initialDocuments: FacilityDocumentRow[];
  initialCursor: string | null;
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [scope, setScope] = useState<Scope>("all");
  const [category, setCategory] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firstRun = useRef(true);

  const fetchPage = useCallback(
    async (after: string | null) => {
      const params = new URLSearchParams({ scope });
      if (category !== "ALL") params.set("category", category);
      if (query.trim()) params.set("patient", query.trim());
      if (after) params.set("cursor", after);
      const res = await fetch(`/api/facility/documents?${params}`);
      if (!res.ok) throw new Error();
      return (await res.json()) as { documents: FacilityDocumentRow[]; nextCursor: string | null };
    },
    [scope, category, query],
  );

  // Re-query the server when a filter changes (the search waits for typing to pause).
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const page = await fetchPage(null);
        if (!active) return;
        setDocuments(page.documents);
        setCursor(page.nextCursor);
      } catch {
        if (active) setError("Could not load documents. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fetchPage]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPage(cursor);
      setDocuments(prev => [...prev, ...page.documents]);
      setCursor(page.nextCursor);
    } catch {
      setError("Could not load more documents. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const download = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/patient/documents/${id}?download=1`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (typeof data.url === "string") {
        window.open(data.url, "_blank", "noopener");
      }
    } catch {
      setError("Could not start the download. You may not have access to this document.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by patient name or case number…"
          aria-label="Search documents by patient"
          className="sm:max-w-sm"
          data-testid="input-document-search"
        />
        <select
          value={scope}
          onChange={e => setScope(e.target.value as Scope)}
          aria-label="Document source"
          className="rounded-lg border border-border bg-background p-2 text-sm"
          data-testid="select-document-scope"
        >
          {SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          aria-label="Document category"
          className="rounded-lg border border-border bg-background p-2 text-sm"
          data-testid="select-document-category"
        >
          <option value="ALL">All categories</option>
          {DOCUMENT_CATEGORIES.map(c => <option key={c} value={c}>{DOCUMENT_CATEGORY_LABELS[c as DocumentCategory]}</option>)}
        </select>
      </div>

      {error && <p className="text-sm text-destructive" role="alert" data-testid="text-download-error">{error}</p>}

      {documents.length === 0 && !loading ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground" data-testid="text-no-documents">
          No documents match. Documents your facility issues, and documents patients share with you, appear here.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm" data-testid="table-facility-documents">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Document</th>
                <th className="px-4 py-2 font-medium">Patient</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Issued</th>
                <th className="px-4 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {documents.map(doc => (
                <tr key={doc.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-medium">{doc.title}</p>
                    <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      {DOCUMENT_CATEGORY_LABELS[doc.category as DocumentCategory] ?? doc.category.replaceAll("_", " ").toLowerCase()}
                      <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px]">
                        {doc.source === "SHARED" ? "Shared with us" : "Issued by us"}
                      </Badge>
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{doc.patient.name}</p>
                    <p className="text-xs text-muted-foreground">Case {doc.patient.caseNumber}</p>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
                    {doc.issuedOn ? new Date(doc.issuedOn).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void download(doc.id)}
                      disabled={busyId === doc.id}
                      aria-label={`Download ${doc.title}`}
                      data-testid={`button-download-${doc.id}`}
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Download
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
        </p>
      )}
      {cursor && !loading && (
        <Button variant="outline" onClick={() => void loadMore()} data-testid="button-load-more-documents">
          Load more
        </Button>
      )}
    </div>
  );
}
