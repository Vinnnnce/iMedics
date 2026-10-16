import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { CARE_CASE_STATUS_LABELS, CARE_CASE_TYPE_LABELS } from "@/lib/cases";
import { StatusChip } from "@/components/shared/status-chip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

// Case detail: one care episode with its linked records. Authorization is by
// patient ownership only — a case number never grants access. Draft
// consultations and unverified results are not shown.
export default async function PatientCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("PATIENT");
  const { id } = await params;

  const patient = await prisma.patient.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!patient) notFound();

  const careCase = await prisma.careCase.findFirst({
    where: { id, patientId: patient.id },
    include: {
      primaryDoctor: { select: { specialty: true, user: { select: { name: true } } } },
      events: { orderBy: { createdAt: "desc" } },
      consultations: {
        where: { status: "FINALIZED" },
        orderBy: { createdAt: "desc" },
        include: {
          doctor: { select: { user: { select: { name: true } } } },
          diagnoses: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }] },
        },
      },
      labOrders: {
        orderBy: { createdAt: "desc" },
        include: { items: { include: { labTest: true } }, results: { select: { id: true, status: true } } },
      },
      prescriptions: { orderBy: { issuedAt: "desc" }, include: { items: true, doctor: { select: { user: { select: { name: true } } } } } },
      payments: false,
      facilityBookings: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!careCase) notFound();

  // Payments belong to this episode either directly (case_id) or through the
  // appointment that a consultation of this case was recorded against — both
  // are recorded relationships, nothing is inferred.
  const episodePayments = await prisma.payment.findMany({
    where: {
      OR: [
        { caseId: careCase.id },
        { appointment: { consultations: { some: { caseId: careCase.id } } } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/patient/cases" className="text-sm text-muted-foreground hover:underline">← My Cases</Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold">
            {careCase.caseNumber}
            <Badge variant="outline" className="rounded-lg">{CARE_CASE_TYPE_LABELS[careCase.type]}</Badge>
            <StatusChip tone={careCase.status === "CLOSED" || careCase.status === "ARCHIVED" ? "neutral" : "success"}>
              {CARE_CASE_STATUS_LABELS[careCase.status]}
            </StatusChip>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Opened {formatDate(careCase.createdAt)}
            {careCase.primaryDoctor ? ` · Dr ${careCase.primaryDoctor.user.name}${careCase.primaryDoctor.specialty ? ` (${careCase.primaryDoctor.specialty})` : ""}` : ""}
            {careCase.followUpDate ? ` · follow-up due ${formatDate(careCase.followUpDate)}` : ""}
          </p>
        </div>
        <Link href={`/patient/history?case=${careCase.caseNumber}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
          View in timeline
        </Link>
      </div>

      {careCase.presentingComplaint || careCase.diagnosisSummary ? (
        <Card>
          <CardContent className="space-y-1 p-4 text-sm">
            {careCase.presentingComplaint ? (
              <p><span className="font-medium">Presenting complaint:</span> {careCase.presentingComplaint}</p>
            ) : null}
            {careCase.diagnosisSummary ? (
              <p><span className="font-medium">Diagnosis summary:</span> {careCase.diagnosisSummary}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Consultations</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {careCase.consultations.length === 0 ? (
              <p className="text-muted-foreground">No finalized consultations in this episode.</p>
            ) : (
              <ul className="space-y-3">
                {careCase.consultations.map((c) => (
                  <li key={c.id} className="border-t pt-2 first:border-t-0 first:pt-0">
                    <p className="font-medium">{formatDate(c.createdAt)} · Dr {c.doctor.user.name}</p>
                    {c.chiefComplaint ? <p className="text-muted-foreground">{c.chiefComplaint}</p> : null}
                    {c.diagnosis ? <p className="text-muted-foreground">{c.diagnosis}</p> : null}
                    {c.diagnoses.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.diagnoses.map((d, i) => (
                          <Badge key={i} variant="outline" className="rounded-lg">{d.code} {d.description}{d.isPrimary ? " (primary)" : ""}</Badge>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Laboratory analyses</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {careCase.labOrders.length === 0 ? (
              <p className="text-muted-foreground">No lab orders in this episode.</p>
            ) : (
              <ul className="space-y-3">
                {careCase.labOrders.map((o) => (
                  <li key={o.id} className="border-t pt-2 first:border-t-0 first:pt-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{formatDate(o.createdAt)} · {o.panelType ?? "Lab order"}</p>
                      <StatusChip tone={o.status === "COMPLETED" ? "success" : "neutral"}>{o.status.toLowerCase().replace("_", " ")}</StatusChip>
                    </div>
                    <p className="text-muted-foreground">{o.items.map((i) => i.labTest.name).join(", ")}</p>
                    {o.results.length > 0 ? (
                      <Link href="/patient/results" className="text-xs underline">View results</Link>
                    ) : (
                      <p className="text-xs text-muted-foreground">Results pending</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Prescriptions</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {careCase.prescriptions.length === 0 ? (
              <p className="text-muted-foreground">No prescriptions in this episode.</p>
            ) : (
              <ul className="space-y-3">
                {careCase.prescriptions.map((p) => (
                  <li key={p.id} className="border-t pt-2 first:border-t-0 first:pt-0">
                    <p className="font-medium">{formatDate(p.issuedAt)} · Dr {p.doctor.user.name}</p>
                    <ul className="text-muted-foreground">
                      {p.items.map((i) => (
                        <li key={i.id}>{i.drugName}{i.dose ? ` ${i.dose}` : ""}{i.frequency ? `, ${i.frequency}` : ""}{i.duration ? `, ${i.duration}` : ""}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Payments</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {episodePayments.length === 0 ? (
              <p className="text-muted-foreground">No payments in this episode.</p>
            ) : (
              <ul className="space-y-2">
                {episodePayments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span>{formatDate(p.createdAt)} · {p.description ?? p.kind.toLowerCase().replace(/_/g, " ")}</span>
                    <span className="flex items-center gap-2">
                      <StatusChip tone={p.status === "SUCCESSFUL" || p.status === "REFUNDED" ? "success" : p.status === "FAILED" ? "danger" : "neutral"}>{p.status.toLowerCase()}</StatusChip>
                      {new Intl.NumberFormat("en", { style: "currency", currency: p.currency }).format(Number(p.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {careCase.facilityBookings.length > 0 ? (
          <Card>
            <CardHeader><CardTitle className="text-lg">Facility bookings</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <ul className="space-y-2">
                {careCase.facilityBookings.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2">
                    <span>{b.serviceName}{b.preferredAt ? ` · ${formatDate(b.preferredAt)}` : ""}</span>
                    <StatusChip tone={b.status === "CONFIRMED" ? "success" : "neutral"}>{b.status.toLowerCase()}</StatusChip>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader><CardTitle className="text-lg">Status history</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <ol className="space-y-2">
              {careCase.events.map((e) => (
                <li key={e.id} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="font-medium">{CARE_CASE_STATUS_LABELS[e.status]}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(e.createdAt)}{e.note ? ` · ${e.note}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
