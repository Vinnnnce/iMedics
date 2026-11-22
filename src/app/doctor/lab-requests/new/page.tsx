import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OrderBuilder, type InitialDraft } from "@/components/investigations/order-builder";
import { DOMAIN_META } from "@/lib/investigations/constants";
import { DOCTOR_DIAGNOSTIC_GROUPS } from "@/lib/investigations/seed-data";
import { prisma } from "@/lib/prisma";
import { getDoctorProfile, requirePageRole } from "@/lib/guards";
import { ageFromDob, formatDate } from "@/lib/format";

interface Props { searchParams: Promise<{ domain?: string; patientId?: string; draft?: string }> }

export default async function NewInvestigationOrderPage({ searchParams }: Props) {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getDoctorProfile(user.id);
  if (!doctor) notFound();
  const sp = await searchParams;
  const domain = sp.domain === "LABORATORY" || sp.domain === "DIAGNOSTIC" ? sp.domain : null;
  if (!domain) redirect("/doctor/lab-requests");

  const assignments = await prisma.patientAssignment.findMany({
    where: { doctorId: doctor.id, status: "ACTIVE", patient: { deletedAt: null } },
    take: 300,
    select: {
      patient: {
        select: {
          id: true, firstName: true, lastName: true, caseNumber: true, dateOfBirth: true, gender: true,
          medicalHistories: { orderBy: { createdAt: "desc" }, take: 1, select: { allergies: true } },
          encounters: { where: { status: { notIn: ["DISCHARGED", "CANCELLED"] } }, orderBy: { createdAt: "desc" }, take: 1, select: { encounterNumber: true } },
        },
      },
    },
  });

  const patients = assignments.map(({ patient: p }) => ({
    id: p.id, name: `${p.firstName} ${p.lastName}`, caseNumber: p.caseNumber, dateOfBirth: formatDate(p.dateOfBirth), age: ageFromDob(p.dateOfBirth), sex: p.gender,
    allergies: Array.isArray(p.medicalHistories[0]?.allergies) ? (p.medicalHistories[0].allergies as unknown[]).map(String) : [],
    encounter: p.encounters[0]?.encounterNumber ?? null,
  }));

  let draft: InitialDraft | undefined;
  if (sp.draft) {
    const d = await prisma.investigation_orders.findFirst({ where: { id: sp.draft, requestedById: user.id, status: "DRAFT", domain }, include: { items: { orderBy: { createdAt: "asc" } } } });
    if (!d) notFound();
    draft = {
      id: d.id, patientId: d.patientId, priority: d.priority, clinicalIndication: d.clinicalIndication ?? "", diagnosis: d.diagnosis ?? "", clinicalNotes: d.clinicalNotes ?? "", referringDepartment: d.referringDepartment ?? "",
      items: d.items.map((i) => ({ catalogueItemId: i.catalogueItemId ?? undefined, custom: (i.customDetails as never) ?? undefined, preferredFacilityId: i.preferredFacilityId ?? undefined, instructions: i.instructions ?? undefined, duplicateOverrideReason: i.duplicateOverrideReason ?? undefined })),
    };
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <Link href="/doctor/lab-requests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Results &amp; Reports</Link>
        <h1 className="mt-1 text-2xl font-bold">{DOMAIN_META[domain].title}</h1>
        <p className="text-sm text-muted-foreground">{DOMAIN_META[domain].subtitle}</p>
      </div>
      <OrderBuilder domain={domain} patients={patients} initialPatientId={sp.patientId} doctorName={user.name} groups={domain === "DIAGNOSTIC" ? DOCTOR_DIAGNOSTIC_GROUPS : null} draft={draft} />
    </div>
  );
}
