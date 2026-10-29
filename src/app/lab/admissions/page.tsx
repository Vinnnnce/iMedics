import Link from "next/link";
import { BedDouble } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CreateAdmissionDialog } from "@/components/lab/admission-forms";
import { requireModulePage } from "@/lib/modules/page-guards";
import { prisma } from "@/lib/prisma";
import { formatClinicDateTime } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  DISCHARGED: "Discharged",
  TRANSFERRED: "Transferred",
  CANCELLED: "Cancelled",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  DISCHARGED: "secondary",
  TRANSFERRED: "outline",
  CANCELLED: "outline",
};

// Hospital Management — admissions list (Module 01, Categories 01 and 03).
export default async function AdmissionsPage() {
  const { facilityId } = await requireModulePage("HOSPITAL");

  const admissions = await prisma.admission.findMany({
    where: { facilityId },
    orderBy: [{ admissionDate: "desc" }],
    take: 100,
    include: {
      patient: { select: { firstName: true, lastName: true, caseNumber: true } },
      admittingDoctor: { select: { user: { select: { name: true } } } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Admissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inpatient episodes — registration, progress notes, transfers and discharge.
          </p>
        </div>
        <CreateAdmissionDialog />
      </div>

      {admissions.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BedDouble className="h-4 w-4" /> No admissions recorded yet.
        </div>
      )}

      {admissions.map((a) => (
        <Card key={a.id} className="beeline-card">
          <CardContent className="flex flex-col justify-between gap-3 p-4 md:flex-row md:items-center">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/lab/admissions/${a.id}`} className="text-sm font-semibold hover:underline">
                  {a.patient.firstName} {a.patient.lastName}
                </Link>
                <Badge variant="outline" className="rounded-lg text-xs">{a.patient.caseNumber}</Badge>
                <Badge variant={STATUS_VARIANT[a.status] ?? "secondary"} className="rounded-lg text-xs">{STATUS_LABEL[a.status]}</Badge>
                {a.ward && <Badge variant="secondary" className="rounded-lg text-xs">{a.ward}{a.bed ? ` · bed ${a.bed}` : ""}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                Admitted {formatClinicDateTime(a.admissionDate)}
                {a.admittingDoctor ? ` · ${a.admittingDoctor.user.name}` : ""}
                {a.workingDiagnosis ? ` · ${a.workingDiagnosis}` : ""}
              </p>
              {a.dischargeDate && (
                <p className="text-xs text-muted-foreground">
                  Discharged {formatClinicDateTime(a.dischargeDate)} · {a.disposition?.toLowerCase()}
                </p>
              )}
            </div>
            <Link href={`/lab/admissions/${a.id}`} className="text-sm text-primary hover:underline">
              Open record
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
