import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDownloadButton } from "@/components/shared/file-download";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";
import { aiAnalysisForViewer } from "@/lib/ai-view";
import { formatDate } from "@/lib/format";

const FLAG_LABEL: Record<string, string> = { NORMAL: "Normal", LOW: "Low", HIGH: "High", CRITICAL_LOW: "Very low", CRITICAL_HIGH: "Very high" };
const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export default async function PatientResultsPage() {
  const user = await requirePageRole("PATIENT");

  const results = await prisma.labResult.findMany({
    where: { patient: { userId: user.id, deletedAt: null }, status: { not: "REJECTED" } },
    orderBy: { testDate: "desc" },
    take: 50,
    include: {
      values: { orderBy: { name: "asc" } },
      files: { select: { id: true, fileName: true } },
      aiAnalysis: true,
      labOrder: { select: { case: { select: { id: true, caseNumber: true } } } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Lab Results</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your test results. Please discuss them with your doctor.</p>
      </div>

      {results.length === 0 && <p className="text-sm text-muted-foreground">You have no lab results yet.</p>}

      {results.map(({ aiAnalysis, ...r }) => {
        // Patients only ever see AI text that a doctor has approved.
        const summary = aiAnalysisForViewer(aiAnalysis, "PATIENT");
        const view = (summary && "patientView" in summary ? summary.patientView : null) as { title?: string; body?: unknown; next_steps?: string; disclaimer?: string } | null;

        return (
          <Card key={r.id} className="beeline-card">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                {r.panelType}
                <Badge variant="outline" className="rounded-lg text-xs">{formatDate(r.testDate)}</Badge>
                {r.labName && <span className="text-xs font-normal text-muted-foreground">{r.labName}</span>}
                {r.labOrder?.case && (
                  <Link href={`/patient/cases/${r.labOrder.case.id}`}>
                    <Badge variant="outline" className="rounded-lg text-xs">{r.labOrder.case.caseNumber}</Badge>
                  </Link>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {r.values.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Test</th>
                        <th className="py-2 pr-3 font-medium">Result</th>
                        <th className="py-2 pr-3 font-medium">Reference</th>
                        <th className="py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.values.map((v) => (
                        <tr key={v.id} className="border-b border-border/50">
                          <td className="py-2 pr-3">{v.name}</td>
                          <td className="py-2 pr-3">{v.value} {v.unit}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{v.refLow != null && v.refHigh != null ? `${v.refLow} – ${v.refHigh}` : "—"}</td>
                          <td className="py-2">{v.flag ? <Badge variant={v.flag === "NORMAL" ? "secondary" : "outline"} className="rounded-lg text-xs">{FLAG_LABEL[v.flag]}</Badge> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {r.interpretation && <p className="text-sm text-muted-foreground">{r.interpretation}</p>}

              {r.files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {r.files.map((f) => (
                    <FileDownloadButton key={f.id} fileId={f.id} fileName={f.fileName} />
                  ))}
                </div>
              )}

              {view && (
                <div className="space-y-1 rounded-lg bg-muted p-3 text-sm">
                  {view.title && <p className="font-medium">{view.title}</p>}
                  {asStrings(view.body).map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                  {view.next_steps && <p className="text-muted-foreground">{view.next_steps}</p>}
                  <p className="pt-1 text-xs text-muted-foreground">{view.disclaimer ?? "Reviewed by your doctor. This is not a diagnosis."}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
