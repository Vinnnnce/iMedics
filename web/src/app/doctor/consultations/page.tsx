"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Sparkles } from "lucide-react";

export default function DoctorConsultationsPage() {
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [aiSummary, setAiSummary] = useState("");

  const generateAiSummary = () => {
    setAiSummary("Based on the patient's symptoms and history, the primary differential diagnoses include tension headache and migraine. Recommend further evaluation if symptoms persist beyond 2 weeks. Consider NSAIDs for acute management.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Write Consultation</h1>
        <p className="text-sm text-muted-foreground mt-1">Record your clinical notes and treatment plan</p>
      </div>

      {/* Patient selector */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Patient</CardTitle>
        </CardHeader>
        <CardContent>
          <Select>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select patient" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">John Doe — MED-2026-04821</SelectItem>
              <SelectItem value="2">Jane Smith — MED-2026-03102</SelectItem>
              <SelectItem value="3">Emily Davis — MED-2026-05104</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Consultation notes */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-primary" />
            Clinical Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="diagnosis">Diagnosis</Label>
            <Input id="diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Primary diagnosis" className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Consultation Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detailed clinical observations..." className="rounded-xl" rows={4} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="treatment">Treatment Plan</Label>
            <Textarea id="treatment" value={treatmentPlan} onChange={(e) => setTreatmentPlan(e.target.value)} placeholder="Prescribed treatment and follow-up plan..." className="rounded-xl" rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* AI Summary */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-accent-teal" />
            AI-Generated Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {aiSummary ? (
            <div className="rounded-xl border border-accent-teal/30 bg-accent-teal/5 p-4">
              <p className="text-sm">{aiSummary}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Generate an AI summary based on your consultation notes.</p>
          )}
          <Button onClick={generateAiSummary} className="bg-accent-teal text-white rounded-xl">
            <Sparkles className="h-4 w-4 mr-1" /> Generate AI Summary
          </Button>
        </CardContent>
      </Card>

      <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 neon-glow rounded-xl h-12 text-base font-bold">
        Save Consultation
      </Button>
    </div>
  );
}
