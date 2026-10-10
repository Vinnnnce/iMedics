import { ClipboardList, FlaskConical, Pill, Stethoscope } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";
import { formatDate } from "@/lib/format";

interface Entry {
  id: string;
  at: Date;
  kind: "consultation" | "lab" | "prescription";
  title: string;
  detail: string | null;
}

const ICONS = { consultation: Stethoscope, lab: FlaskConical, prescription: Pill } as const;

export default async function PatientHistoryPage() {
  const user = await requirePageRole("PATIENT");
  const owner = { patient: { userId: user.id, deletedAt: null } };

  const [consultations, labs, prescriptions] = await Promise.all([
    prisma.consultation.findMany({
      where: { ...owner, status: "FINALIZED" },
      orderBy: { finalizedAt: "desc" },
      take: 50,
      select: { id: true, createdAt: true, finalizedAt: true, chiefComplaint: true, diagnosis: true, doctor: { select: { user: { select: { name: true } } } } },
    }),
    prisma.labResult.findMany({ where: { ...owner, status: { not: "REJECTED" } }, orderBy: { testDate: "desc" }, take: 50, select: { id: true, testDate: true, panelType: true, labName: true } }),
    prisma.prescription.findMany({ where: owner, orderBy: { issuedAt: "desc" }, take: 50, select: { id: true, issuedAt: true, doctor: { select: { user: { select: { name: true } } } }, items: { select: { drugName: true } } } }),
  ]);

  const entries: Entry[] = [
    ...consultations.map((c) => ({
      id: c.id,
      at: c.finalizedAt ?? c.createdAt,
      kind: "consultation" as const,
      title: `Consultation with ${c.doctor.user.name}`,
      detail: [c.chiefComplaint && `Reason: ${c.chiefComplaint}`, c.diagnosis && `Diagnosis: ${c.diagnosis}`].filter(Boolean).join(" · ") || null,
    })),
    ...labs.map((l) => ({ id: l.id, at: l.testDate, kind: "lab" as const, title: `Lab test: ${l.panelType}`, detail: l.labName })),
    ...prescriptions.map((p) => ({
      id: p.id,
      at: p.issuedAt,
      kind: "prescription" as const,
      title: `Prescription from ${p.doctor.user.name}`,
      detail: p.items.map((i) => i.drugName).join(", ") || null,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Case History</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your consultations, tests and prescriptions over time</p>
      </div>

      {entries.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClipboardList className="h-4 w-4" /> Nothing in your history yet.
        </div>
      )}

      <div className="space-y-3">
        {entries.map((e) => {
          const Icon = ICONS[e.kind];
          return (
            <Card key={`${e.kind}-${e.id}`} className="beeline-card">
              <CardContent className="flex items-start gap-3 p-4">
                <Icon className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{e.title}</p>
                  {e.detail && <p className="text-xs text-muted-foreground">{e.detail}</p>}
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(e.at)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
