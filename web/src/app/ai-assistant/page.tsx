"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AIAssistantPanel } from "@/components/ai-assistant-panel";
import { apiClient } from "@/lib/api-client";
import { Sparkles, AlertCircle } from "lucide-react";
import type { Prisma } from "@prisma/client";

type Patient = Prisma.PatientGetPayload<{
  include: { medicalHistories: true };
}>;

type MedicalHistory = Prisma.MedicalHistoryGetPayload<{}>;

export default function AIAssistantPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [histories, setHistories] = useState<MedicalHistory[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPatients() {
      try {
        const data = await apiClient.get<{ patients: Patient[]; total: number }>("/patients");
        setPatients(data.patients);
      } catch (err) {
        console.error("Failed to load patients:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPatients();
  }, []);

  async function loadHistories(patientId: string) {
    setSelectedPatientId(patientId);
    setSelectedHistoryId(null);
    try {
      const data = await apiClient.get<{ histories: MedicalHistory[] }>(
        `/patients/${patientId}/history`
      );
      setHistories(data.histories);
      if (data.histories.length > 0) {
        setSelectedHistoryId(data.histories[0].id);
      }
    } catch (err) {
      console.error("Failed to load histories:", err);
    }
  }

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);
  const selectedHistory = histories.find((h) => h.id === selectedHistoryId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Assistant
        </h1>
        <p className="text-sm text-muted-foreground">
          Generate AI-assisted insights from patient medical histories
        </p>
      </div>

      {/* Safety notice */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-xs text-muted-foreground">
          AI output is assistive only. Not a diagnosis. All outputs must be
          clinician-reviewed before clinical use.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Patient</CardTitle>
          <CardDescription>
            Choose a patient and medical history to analyze
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading patients...</p>
          ) : patients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No patients found. Please register a patient first.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Patient</label>
                <Select onValueChange={(v) => v && loadHistories(v)} value={selectedPatientId || ""}>
                  <SelectTrigger data-testid="select-ai-patient">
                    <SelectValue placeholder="Select a patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.lastName}, {p.firstName} ({p.caseNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Medical History</label>
                <Select
                  onValueChange={(v) => v && setSelectedHistoryId(v)}
                  value={selectedHistoryId || ""}
                  disabled={histories.length === 0}
                >
                  <SelectTrigger data-testid="select-ai-history">
                    <SelectValue placeholder="Select a history" />
                  </SelectTrigger>
                  <SelectContent>
                    {histories.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.chiefComplaint || "No complaint"} — {h.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {histories.length === 0 && selectedPatientId && (
                  <p className="text-xs text-muted-foreground">
                    No medical history found for this patient.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Panel */}
      {selectedPatientId && selectedHistoryId && selectedPatient && selectedHistory ? (
        <div className="flex h-[calc(100vh-20rem)]">
          <div className="w-full max-w-md">
            <AIAssistantPanel
              patientId={selectedPatientId}
              historyId={selectedHistoryId}
              chiefComplaint={selectedHistory.chiefComplaint || undefined}
              symptoms={(selectedHistory.symptoms as any[]) || []}
            />
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
            <Sparkles className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Select a patient and medical history to generate AI-assisted insights.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
