import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getPatientProfile, requirePageRole } from "@/lib/guards";
import { ageFromDob, formatDate } from "@/lib/format";
import { calculateBMI } from "@/lib/bmi";
import { notFound } from "next/navigation";

// Pull display text out of the loosely-structured JSON lists on a medical history.
function labels(value: unknown, keys: string[]): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === "object" ? keys.map((k) => (item as Record<string, unknown>)[k]).find((v) => typeof v === "string" && v) : null))
    .filter((v): v is string => typeof v === "string");
}

export default async function PatientCaseFilePage() {
  const user = await requirePageRole("PATIENT");
  const patient = await getPatientProfile(user.id);
  if (!patient) notFound();

  const [careTeam, history] = await Promise.all([
    prisma.patientAssignment.findMany({ take: 100,
      where: { patientId: patient.id, status: "ACTIVE" },
      include: { doctor: { select: { specialty: true, user: { select: { name: true } } } } },
    }),
    prisma.medicalHistory.findFirst({ where: { patientId: patient.id }, orderBy: { createdAt: "desc" } }),
  ]);

  const bmi = calculateBMI(patient.height, patient.weight);
  const allergies = labels(history?.allergies, ["allergen", "name"]);
  const conditions = labels(history?.pastHistory, ["diagnosis", "condition", "name"]);

  const details: [string, string | null][] = [
    ["Case number", patient.caseNumber],
    ["Age", `${ageFromDob(patient.dateOfBirth)} (born ${formatDate(patient.dateOfBirth)})`],
    ["Sex", patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()],
    ["Blood group / genotype", [patient.bloodGroup, patient.genotype].filter(Boolean).join(" / ") || null],
    ["Height / weight", patient.height && patient.weight ? `${patient.height} cm / ${patient.weight} kg${bmi ? ` (BMI ${bmi.value})` : ""}` : null],
    ["Occupation", patient.occupation],
    ["Address", [patient.addressLine1, patient.city, patient.state].filter(Boolean).join(", ") || null],
    ["Emergency contact", patient.ecName ? `${patient.ecName}${patient.ecRelationship ? ` (${patient.ecRelationship})` : ""}${patient.ecPhone ? ` — ${patient.ecPhone}` : ""}` : null],
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">
          {patient.firstName} {patient.lastName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Your case file</p>
      </div>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Personal details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p>{value || "—"}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Health summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Allergies</p>
            {allergies.length ? <div className="flex flex-wrap gap-2">{allergies.map((a) => <Badge key={a} variant="outline" className="rounded-lg">{a}</Badge>)}</div> : <p className="text-muted-foreground">None recorded</p>}
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Past conditions</p>
            {conditions.length ? <div className="flex flex-wrap gap-2">{conditions.map((c) => <Badge key={c} variant="outline" className="rounded-lg">{c}</Badge>)}</div> : <p className="text-muted-foreground">None recorded</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Your care team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {careTeam.length === 0 && <p className="text-muted-foreground">No doctors yet. Book an appointment to get started.</p>}
          {careTeam.map((c) => (
            <p key={c.id}>
              {c.doctor.user.name} {c.doctor.specialty && <span className="text-muted-foreground">— {c.doctor.specialty}</span>}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
