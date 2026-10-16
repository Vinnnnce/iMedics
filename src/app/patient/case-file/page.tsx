import Link from "next/link";
import { requirePageRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { CARE_CASE_STATUS_LABELS, CARE_CASE_TYPE_LABELS } from "@/lib/cases";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { PrintButton } from "@/components/shared/print-button";
import { StatusChip } from "@/components/shared/status-chip";
import {
  AlertTriangle, FlaskConical, MessageSquare, Pencil, Receipt, Stethoscope,
  Upload, Building2, ShieldCheck, FolderOpen,
} from "lucide-react";

function calculateAge(dob: Date): number {
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

// Patient case file: the profile header (spec §3), the medical summary with
// provenance (spec §4) and the existing care-team view. Patient-reported intake
// data is always labelled and never presented as clinician-verified; missing
// optional information is prompted, never forced.

function hasData(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default async function PatientCaseFilePage() {
  const user = await requirePageRole("PATIENT");
  const patient = await prisma.patient.findFirst({
    where: { userId: user.id, deletedAt: null },
    include: {
      medicalHistories: { orderBy: { createdAt: "desc" }, take: 3 },
      assignments: { where: { status: "ACTIVE" }, include: { doctor: { include: { user: { select: { name: true } } } } } },
      prescriptions: { where: { status: "ACTIVE" }, orderBy: { issuedAt: "desc" }, take: 10, include: { items: true } },
      conversations: { select: { id: true, messages: { where: { readAt: null, senderId: { not: user.id } }, select: { id: true } } } },
      labResults: { where: { status: { in: ["PENDING", "PENDING_AI_ANALYSIS", "AI_ANALYSIS_COMPLETE"] } }, select: { id: true } },
      appointments: { where: { status: { in: ["BOOKED", "CONFIRMED", "IN_PROGRESS"] }, scheduledAt: { gte: new Date() } }, select: { id: true } },
      careCases: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  // Payments are made by the user (payer), not the patient record — query separately.
  const pendingPayments = await prisma.payment.count({
    where: { payerId: user.id, status: "PENDING" },
  });

  if (!patient) return <p className="p-6 text-sm">No patient record is linked to your account yet.</p>;

  const latestHistory = patient.medicalHistories.find((h) => h.status === "COMPLETE") ?? null;
  const latestIntakeAt = latestHistory ? formatDate(latestHistory.createdAt) : null;

  // The patient explicitly reported absence when a completed intake exists but
  // the list is empty — that is different from "not recorded yet".
  const hasCompletedIntake = Boolean(latestHistory);
  const absenceLabel = hasCompletedIntake ? "None reported" : "Not recorded yet";

  type AllergyItem = { type: string; allergen: string; reactionType?: string; severity?: string };
  type MedicationItem = { name: string; dose?: string; frequency?: string; duration?: string; status?: string };
  type FamilyItem = { condition: string; relationship?: string; ageAtOnset?: string };
  type PastItem = { diagnosis: string; date?: string; outcome?: string };
  type ImmunizationItem = { vaccine: string; date?: string; status?: string };
  type MentalHealthItem = { condition: string; duration?: string; treatment?: string };

  const allergies = ((latestHistory?.allergies as AllergyItem[] | null) ?? []).filter((a) => a && a.allergen);
  const severeAllergies = allergies.filter((a) => a.severity === "severe");
  const reportedMedications = ((latestHistory?.medications as MedicationItem[] | null) ?? []).filter((m) => m && m.name);
  const immunizations = ((latestHistory?.immunizations as ImmunizationItem[] | null) ?? []).filter((v) => v && v.vaccine);
  const familyHistory = ((latestHistory?.familyHistory as FamilyItem[] | null) ?? []).filter((f) => f && f.condition);
  const pastHistory = ((latestHistory?.pastHistory as PastItem[] | null) ?? []).filter((p) => p && p.diagnosis);
  const mentalHealth = ((latestHistory?.mentalHealth as MentalHealthItem[] | null) ?? []).filter((m) => m && m.condition);

  // Chronic conditions are structured intake answers, not a list — map the
  // recorded booleans to display rows without inventing detail.
  const chronicConditions: { name: string; detail?: string }[] = [];
  if (latestHistory?.hasDiabetes) chronicConditions.push({ name: "Diabetes", detail: latestHistory.diabetesType ?? undefined });
  if (latestHistory?.hasStroke) chronicConditions.push({ name: "Stroke", detail: latestHistory.strokeDate ? `date: ${latestHistory.strokeDate}` : undefined });
  if (latestHistory?.hasHeartAttack) chronicConditions.push({ name: "Heart attack", detail: latestHistory.heartAttackDate ? `date: ${latestHistory.heartAttackDate}` : undefined });
  if (latestHistory?.hasWound) chronicConditions.push({ name: "Active wound/injury", detail: latestHistory.woundLocation ?? undefined });

  const activePrescriptions = patient.prescriptions;

  // Profile completion: presence of the fields patients are expected to manage.
  const completionFields = [
    Boolean(user.phone),
    hasData(patient.addressLine1),
    hasData(patient.ecName) && hasData(patient.ecPhone),
    hasCompletedIntake,
    hasData(patient.bloodGroup),
  ];
  const completion = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);

  const statusChips = [
    { label: "Upcoming appointments", value: patient.appointments.length, href: "/patient/appointments", icon: Stethoscope },
    { label: "Results pending", value: patient.labResults.length, href: "/patient/results", icon: FlaskConical },
    { label: "Unread messages", value: patient.conversations.reduce((n, c) => n + c.messages.length, 0), href: "/patient/consult", icon: MessageSquare },
    { label: "Outstanding payments", value: pendingPayments, href: "/payments", icon: Receipt },
  ];

  const emergencyContact = patient.ecName ? `${patient.ecName}${patient.ecRelationship ? ` (${patient.ecRelationship})` : ""}${patient.ecPhone ? ` · ${patient.ecPhone}` : ""}` : null;
  const address = [patient.addressLine1, patient.addressLine2, patient.city, patient.state, patient.postalCode, patient.country].filter(Boolean).join(", ") || null;
  const primaryDoctor = patient.assignments[0]?.doctor;

  return (
    <div className="space-y-6">
      {/* --- Profile header --- */}
      <Card className="beeline-card">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
                  {initialsOf(patient.firstName, patient.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold">
                    {patient.firstName} {patient.lastName}
                  </h1>
                  {patient.preferredName ? <span className="text-sm text-muted-foreground">&ldquo;{patient.preferredName}&rdquo;</span> : null}
                  <Badge variant="outline" className="rounded-lg">Medic1905 ID: {patient.caseNumber}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  DOB {formatDate(patient.dateOfBirth)} · {calculateAge(patient.dateOfBirth)} years · {patient.gender.toLowerCase()}
                  {patient.bloodGroup ? ` · Blood group ${patient.bloodGroup}` : ""}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge variant={user.status === "ACTIVE" ? "default" : "secondary"} className="rounded-lg">
                    {user.status === "ACTIVE" ? "Account active" : user.status.toLowerCase()}
                  </Badge>
                  <Badge variant="outline" className="rounded-lg">Language: {user.language.toUpperCase()}</Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 md:items-end">
              <div className="w-full max-w-56">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Profile completion</span>
                  <span>{completion}%</span>
                </div>
                <Progress value={completion} className="mt-1 h-2" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/profile" className={buttonVariants({ size: "sm" })}><Pencil className="mr-1 h-3.5 w-3.5" />Edit profile</Link>
                <Link href="/dashboard?tab=records" className={buttonVariants({ size: "sm", variant: "outline" })}><Upload className="mr-1 h-3.5 w-3.5" />Upload document</Link>
                <Link href="/doctors" className={buttonVariants({ size: "sm", variant: "outline" })}><Stethoscope className="mr-1 h-3.5 w-3.5" />Book consultation</Link>
                <Link href="/facilities" className={buttonVariants({ size: "sm", variant: "outline" })}><Building2 className="mr-1 h-3.5 w-3.5" />Find diagnostic centre</Link>
                <PrintButton label="Download health summary" />
                <Link href="/dashboard?tab=records" className={buttonVariants({ size: "sm", variant: "outline" })}><ShieldCheck className="mr-1 h-3.5 w-3.5" />Manage privacy</Link>
              </div>
            </div>
          </div>

          {/* Status indicators */}
          <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
            {statusChips.map((chip) => (
              <Link
                key={chip.label}
                href={chip.href}
                className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  <chip.icon className="h-4 w-4" />
                  {chip.label}
                </span>
                <span className={`font-semibold ${chip.value > 0 ? "text-foreground" : "text-muted-foreground"}`}>{chip.value}</span>
              </Link>
            ))}
          </div>

          {/* Contact details */}
          <div className="mt-6 grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p>{user.phone ?? <span className="text-muted-foreground">Not provided yet — <Link className="underline" href="/profile">add a phone number</Link></span>}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p>{user.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Residential address</p>
              <p>{address ?? <span className="text-muted-foreground">Not provided yet</span>}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Emergency contact</p>
              <p>{emergencyContact ?? <span className="text-muted-foreground">Not provided yet — <Link className="underline" href="/profile">add an emergency contact</Link></span>}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --- Severe allergy / critical condition alerts (only from recorded data) --- */}
      {severeAllergies.length > 0 ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
            <div className="text-sm">
              <p className="font-medium">Severe allergy on record</p>
              <p className="text-muted-foreground">
                {severeAllergies.map((a) => `${a.allergen}${a.reactionType ? ` (${a.reactionType})` : ""}`).join(", ")} — patient-reported{latestIntakeAt ? ` · intake ${latestIntakeAt}` : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* --- Medical summary --- */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="text-lg">Allergies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {allergies.length > 0 ? (
              allergies.map((a, i) => (
                <div key={i} className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{a.allergen}{a.type ? ` (${a.type.toLowerCase()})` : ""}{a.reactionType ? ` — ${a.reactionType}` : ""}</p>
                    {a.severity ? <p className="text-xs text-muted-foreground">Severity: {a.severity.replace("_", " ").toLowerCase()}</p> : null}
                  </div>
                  <Badge variant="outline" className="rounded-lg whitespace-nowrap">Patient-reported</Badge>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">{absenceLabel}{latestIntakeAt ? ` · last intake ${latestIntakeAt}` : ""}</p>
            )}
            <p className="pt-2 text-xs text-muted-foreground">
              Patient-reported information is not clinician-verified. Share it with your doctor so it can be confirmed.
            </p>
          </CardContent>
        </Card>

        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="text-lg">Chronic conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {chronicConditions.length > 0 ? (
              chronicConditions.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    {c.detail ? <p className="text-xs text-muted-foreground">{c.detail}</p> : null}
                  </div>
                  <Badge variant="outline" className="rounded-lg whitespace-nowrap">Patient-reported</Badge>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">{absenceLabel}</p>
            )}
          </CardContent>
        </Card>

        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="text-lg">Medications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Current prescriptions (clinician-issued)</p>
              {activePrescriptions.length > 0 ? (
                <ul className="space-y-1">
                  {activePrescriptions.map((p) => (
                    <li key={p.id}>
                      {p.items.map((i) => `${i.drugName}${i.dose ? ` ${i.dose}` : ""}${i.frequency ? `, ${i.frequency}` : ""}`).join("; ")}
                      <span className="block text-xs text-muted-foreground">Issued {formatDate(p.issuedAt)} · {p.status.toLowerCase()}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No active prescriptions</p>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Patient-reported medications</p>
              {reportedMedications.length > 0 ? (
                <ul className="space-y-1">
                  {reportedMedications.map((m, i) => (
                    <li key={i}>{m.name}{m.dose ? ` ${m.dose}` : ""}{m.frequency ? `, ${m.frequency}` : ""}{m.status ? ` · ${m.status}` : ""}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">{absenceLabel}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="text-lg">Immunizations</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {immunizations.length > 0 ? (
              <ul className="space-y-1">
                {immunizations.map((v, i) => (
                  <li key={i}>
                    {v.vaccine}{v.date ? ` · ${formatDate(v.date)}` : ""}{v.status ? ` · ${v.status}` : ""}
                    <Badge variant="outline" className="ml-2 rounded-lg">Patient-reported</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">{absenceLabel}</p>
            )}
          </CardContent>
        </Card>

        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="text-lg">Family history</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {familyHistory.length > 0 ? (
              <ul className="space-y-1">
                {familyHistory.map((f, i) => (
                  <li key={i}>
                    {f.condition}{f.relationship ? ` — ${f.relationship.toLowerCase()}` : ""}{f.ageAtOnset ? ` (age at onset: ${f.ageAtOnset})` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">{absenceLabel}</p>
            )}
          </CardContent>
        </Card>

        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="text-lg">Past medical & surgical history</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {pastHistory.length > 0 ? (
              <ul className="space-y-1">
                {pastHistory.map((p, i) => (
                  <li key={i}>
                    {p.diagnosis}{p.date ? ` · ${formatDate(p.date)}` : ""}{p.outcome ? ` · outcome: ${p.outcome.toLowerCase()}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">{absenceLabel}</p>
            )}
          </CardContent>
        </Card>

        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="text-lg">Lifestyle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Smoking: {latestHistory?.smokingStatus ? latestHistory.smokingStatus.toLowerCase() : <span className="text-muted-foreground">not recorded</span>}</p>
            <p>Alcohol: {latestHistory?.alcoholUse ? latestHistory.alcoholUse.toLowerCase() : <span className="text-muted-foreground">not recorded</span>}</p>
            <p>Exercise: {latestHistory?.physicalActivity ? latestHistory.physicalActivity.toLowerCase() : <span className="text-muted-foreground">not recorded</span>}</p>
            <p>Sleep: {latestHistory?.sleepPattern ? latestHistory.sleepPattern.toLowerCase() : <span className="text-muted-foreground">not recorded</span>}</p>
            {mentalHealth.length > 0 ? (
              <div className="pt-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">Mental health (patient-reported)</p>
                <ul className="space-y-0.5">
                  {mentalHealth.map((m, i) => (
                    <li key={i}>{m.condition}{m.treatment ? ` — treatment: ${m.treatment}` : ""}{m.duration ? ` (${m.duration})` : ""}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="text-lg">Care preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              Primary care doctor:{" "}
              {primaryDoctor ? `${primaryDoctor.user.name}${primaryDoctor.specialty ? ` (${primaryDoctor.specialty})` : ""}` : <span className="text-muted-foreground">not assigned</span>}
            </p>
            <p>Organ donor status: {patient.organDonorStatus === null ? <span className="text-muted-foreground">not recorded — optional</span> : patient.organDonorStatus ? "Yes" : "No"}</p>
            <p className="pt-2 text-xs text-muted-foreground">
              You can update these details any time from <Link className="underline" href="/profile">your profile</Link>. Optional information is never required.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* --- Recent care episodes --- */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Recent care episodes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {patient.careCases.length > 0 ? (
            <ul className="divide-y">
              {patient.careCases.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <Link className="font-medium underline-offset-2 hover:underline" href={`/patient/cases/${c.id}`}>
                      {c.caseNumber}
                    </Link>
                    <span className="ml-2 text-muted-foreground">{CARE_CASE_TYPE_LABELS[c.type]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusChip tone={c.status === "CLOSED" || c.status === "ARCHIVED" ? "neutral" : "success"}>{CARE_CASE_STATUS_LABELS[c.status]}</StatusChip>
                    <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              No care episodes yet. Episodes are created automatically when you have a consultation, lab order or facility booking.
            </p>
          )}
          <div className="pt-3">
            <Link href="/patient/cases" className={buttonVariants({ size: "sm", variant: "outline" })}><FolderOpen className="mr-1 h-3.5 w-3.5" />View all cases</Link>
          </div>
        </CardContent>
      </Card>

      {/* --- Care team --- */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Care team</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {patient.assignments.length > 0 ? (
            <ul className="space-y-1">
              {patient.assignments.map((a) => (
                <li key={a.id}>
                  {a.doctor.user.name}{a.doctor.specialty ? ` — ${a.doctor.specialty}` : ""} · assigned {formatDate(a.admittedAt)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No doctors are assigned to your care yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
