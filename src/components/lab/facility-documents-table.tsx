"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface FacilityDocumentRow {
  id: string;
  category: string;
  title: string;
  issuedOn: string | null;
  notes: string | null;
  createdAt: string;
  patient: { name: string; caseNumber: string };
  uploadedBy: string;
}

/**
 * Read-only table of the documents a facility issued. Downloads go through
 * the audited presigned-URL route; failures surface as a message.
 */
export function FacilityDocumentsTable({ documents }: { documents: FacilityDocumentRow[] }) {
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = documents.filter(doc =>
    `${doc.title} ${doc.patient.name} ${doc.patient.caseNumber}`.toLowerCase().includes(query.toLowerCase()),
  );

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

  if (documents.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground" data-testid="text-no-documents">
        Your facility has not issued any patient documents yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search by title, patient or case number…"
        aria-label="Search documents"
        className="max-w-sm"
        data-testid="input-document-search"
      />
      {error && <p className="text-sm text-destructive" role="alert" data-testid="text-download-error">{error}</p>}
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
            {filtered.map(doc => (
              <tr key={doc.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-medium">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">{doc.category.replaceAll("_", " ").toLowerCase()}</p>
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No documents match that search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
