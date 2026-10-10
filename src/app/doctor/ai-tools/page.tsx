import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ReviewActions } from "@/components/doctor/review-actions";
import { requirePageRole } from "@/lib/guards";
import { listPendingReview } from "@/lib/data/ai-review";
import { formatClinicDateTime } from "@/lib/format";

const asStrings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

const URGENCY_LABEL: Record<string, string> = { critical: "Critical values", attention: "Needs attention", routine: "Routine" };

export default async function DoctorAiToolsPage() {
  const user = await requirePageRole("DOCTOR");
  const analyses = await listPendingReview(user);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Review</h1>
        <p className="mt-1 text-sm text-muted-foreground">Approve or reject AI summaries before patients can see them</p>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted p-4">
        <Sparkles className="h-5 w-5 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          AI output is assistive only and is never shown to a patient until you approve it. You remain responsible for all clinical decisions.
        </p>
      </div>

      {analyses.length === 0 && <p className="text-sm text-muted-foreground">Nothing is waiting for your review.</p>}

      <div className="space-y-4">
        {analyses.map((a) => {
          const view = (a.doctorView ?? {}) as { summary?: unknown; suggested_followup?: unknown };
          const summary = asStrings(view.summary);
          const followup = asStrings(view.suggested_followup);
          const patientView = (a.patientView ?? null) as { title?: string; body?: unknown } | null;
          const flags = asStrings(a.flags);

          return (
            <Card key={a.id} className="beeline-card">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      {a.source.patient ? (
                        <Link href={`/patients/${a.source.patient.id}`} className="text-sm font-semibold hover:underline">
                          {a.source.patient.name}
                        </Link>
                      ) : (
                        <p className="text-sm font-semibold">Unknown patient</p>
                      )}
                      <Badge variant="outline" className="rounded-lg text-xs">
                        {a.source.type === "lab_result" ? `Lab: ${a.source.label ?? "result"}` : a.source.type === "medical_history" ? "Medical history" : "Consultation"}
                      </Badge>
                      <Badge variant={a.urgencyLevel === "critical" ? "default" : "secondary"} className="rounded-lg text-xs">
                        {URGENCY_LABEL[a.urgencyLevel] ?? a.urgencyLevel}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Generated {formatClinicDateTime(a.createdAt)}</p>
                  </div>
                  <ReviewActions analysisId={a.id} canApprove={Boolean(a.patientView)} />
                </div>

                {a.status === "COMPLETED_WITH_OVERRIDE" && (
                  <p className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
                    The safety filter changed or flagged part of this output. Review it carefully.
                  </p>
                )}

                {flags.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {flags.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                )}

                {summary.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Summary for you</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                      {summary.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {followup.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Suggested follow-up</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                      {followup.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {patientView && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Text the patient would see if you approve</summary>
                    <div className="mt-2 space-y-1 rounded-lg border border-border p-3">
                      {patientView.title && <p className="font-medium">{patientView.title}</p>}
                      {asStrings(patientView.body).map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
