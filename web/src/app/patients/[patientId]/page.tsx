"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { calculateBMI, getBMIColor } from "@/lib/bmi";
import { apiClient } from "@/lib/api-client";
import {
  ArrowLeft,
  FileText,
  Phone,
  MapPin,
  User,
  AlertCircle,
} from "lucide-react";
import type { Prisma } from "@prisma/client";

type Patient = Prisma.PatientGetPayload<{
  include: { medicalHistories: true };
}>;

export default function PatientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params.patientId as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPatient() {
      try {
        const data = await apiClient.get<Patient>(`/patients/${patientId}`);
        setPatient(data);
      } catch (err) {
        console.error("Failed to load patient:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPatient();
  }, [patientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Loading patient...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Patient not found.</p>
        <Button variant="outline" onClick={() => router.push("/patients")}>
          Back to Patients
        </Button>
      </div>
    );
  }

  const bmiResult = calculateBMI(patient.height, patient.weight);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/patients")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">
            {patient.lastName}, {patient.firstName}
            {patient.middleName ? ` ${patient.middleName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Case: <span className="font-mono">{patient.caseNumber}</span>
          </p>
        </div>
        <Link href={`/patients/${patientId}/history`}>
          <Button className="gap-1.5" data-testid="button-view-history">
            <FileText className="h-4 w-4" />
            Medical History
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Patient Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Patient Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Date of Birth" value={patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : "—"} />
            <InfoRow label="Gender" value={<Badge variant="secondary" className="capitalize">{patient.gender}</Badge>} />
            <InfoRow label="Occupation" value={patient.occupation || "—"} />
            <Separator />
            <InfoRow label="Height" value={patient.height ? `${patient.height} cm` : "—"} />
            <InfoRow label="Weight" value={patient.weight ? `${patient.weight} kg` : "—"} />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">BMI</span>
              {bmiResult ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{bmiResult.value}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${getBMIColor(bmiResult.category)}`}>
                    {bmiResult.label}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Address & Emergency Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Contact & Emergency
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Address</p>
              <p className="text-sm">
                {patient.addressLine1 || "—"}
                {patient.addressLine2 && <br />}
                {patient.addressLine2}
                {(patient.city || patient.state || patient.postalCode) && (
                  <br />
                )}
                {[patient.city, patient.state, patient.postalCode, patient.country].filter(Boolean).join(", ")}
              </p>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Emergency Contact</p>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {patient.ecName || "—"}
              </div>
              {patient.ecRelationship && (
                <p className="text-sm text-muted-foreground pl-5.5">
                  {patient.ecRelationship}
                </p>
              )}
              {patient.ecPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  {patient.ecPhone}
                </div>
              )}
              {patient.ecAddress && (
                <p className="text-sm text-muted-foreground pl-5.5">
                  {patient.ecAddress}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Medical Histories */}
      {patient.medicalHistories && patient.medicalHistories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Medical Histories</CardTitle>
            <CardDescription>Recorded medical history entries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {patient.medicalHistories.map((h) => (
                <Link
                  key={h.id}
                  href={`/patients/${patientId}/history`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {h.chiefComplaint || "No chief complaint recorded"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(h.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={h.status === "complete" ? "default" : "secondary"}>
                    {h.status}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
