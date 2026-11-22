import { FileText, FlaskConical, FolderOpen, ScanLine, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DX_FOLDER_ORDER, LAB_FOLDER_ORDER, releasedReportsForPatient } from "@/lib/investigations/records";

/**
 * Laboratory and diagnostic report folders of the central case file. Server
 * component: it only ever selects RELEASED reports (patient-visible ones for
 * patients), so unreleased or internal reports cannot reach this view.
 */
export async function InvestigationReportFolders({ patientId, viewer }: { patientId: string; viewer: "DOCTOR" | "PATIENT" }) {
  const reports = await releasedReportsForPatient(patientId, viewer);
  const groups = [
    { title: "Laboratory Reports", icon: FlaskConical, order: LAB_FOLDER_ORDER, domain: "LABORATORY" as const },
    { title: "Diagnostic Reports", icon: ScanLine, order: DX_FOLDER_ORDER, domain: "DIAGNOSTIC" as const },
  ];
  return (
    <section aria-label="Investigation reports" className="space-y-3">
      <h2 className="text-lg font-semibold">Investigation reports</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((g) => {
          const inGroup = reports.filter((r) => r.domain === g.domain);
          return (
            <Card key={g.title}>
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><g.icon className="size-4 text-primary" aria-hidden />{g.title} <Badge variant="secondary">{inGroup.length}</Badge></CardTitle><CardDescription>Verified and released reports only.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {inGroup.length === 0 && <p className="text-sm text-muted-foreground">No released reports yet.</p>}
                {g.order.map((folder) => {
                  const list = inGroup.filter((r) => r.folder === folder);
                  if (list.length === 0) return null;
                  return (
                    <details key={folder} open className="rounded-lg border">
                      <summary className="flex cursor-pointer items-center gap-2 p-2.5 text-sm font-medium"><FolderOpen className="size-4 text-muted-foreground" aria-hidden />{folder}<span className="text-xs text-muted-foreground">({list.length})</span></summary>
                      <ul className="divide-y border-t">
                        {list.map((r) => (
                          <li key={`${r.itemId}-${r.version}`} className="flex flex-wrap items-center justify-between gap-2 p-2.5">
                            <div className="min-w-0"><p className="flex items-center gap-1.5 text-sm font-medium"><FileText className="size-3.5 text-muted-foreground" aria-hidden />{r.name}{r.version > 1 && <Badge variant="warning">Amended</Badge>}{r.hasCritical && viewer === "DOCTOR" && <Badge variant="destructive"><TriangleAlert aria-hidden />Critical</Badge>}</p><p className="text-xs text-muted-foreground">{r.facility ?? "Facility"} · {r.releasedAt.toLocaleDateString()} · {r.orderNumber}</p></div>
                            <a className={buttonVariants({ size: "xs", variant: "outline" })} href={`/api/investigations/items/${r.itemId}/report`} target="_blank" rel="noreferrer">View report</a>
                          </li>
                        ))}
                      </ul>
                    </details>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
