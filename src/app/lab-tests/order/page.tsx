"use client";
import { useState } from "react";
import { User, FlaskConical, MapPin, Calendar, FileText, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function LabOrderForm() {
  const [submitted, setSubmitted] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedTest, setSelectedTest] = useState("");
  const [selectedLab, setSelectedLab] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [notes, setNotes] = useState("");

  const patients = [
    { id: "1", name: "John Anderson", caseNumber: "MED-1905-2024" },
    { id: "2", name: "Maria Garcia", caseNumber: "MED-1905-2025" },
    { id: "3", name: "Robert Kim", caseNumber: "MED-1905-2026" },
  ];

  const tests = [
    { id: "1", name: "Complete Blood Count (CBC)", price: 25 },
    { id: "2", name: "Lipid Panel", price: 35 },
    { id: "3", name: "Comprehensive Metabolic Panel", price: 45 },
    { id: "4", name: "Urinalysis", price: 20 },
  ];

  const labs = ["Central Lab", "MedLab Express", "BioDiagnostics Center", "CityPath Laboratory"];

  const handleSubmit = () => {
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card className="border-primary/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary mb-4">
              <Check className="h-10 w-10" />
            </div>
            <h2 className="font-display text-2xl font-bold">Order Submitted!</h2>
            <p className="text-muted-foreground mt-1">Your lab test order has been placed successfully.</p>
            <div className="mt-6 flex gap-3">
              <Button variant="neon" onClick={() => setSubmitted(false)}>Order Another Test</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-extrabold">Order Lab Test</h1>
        <p className="text-muted-foreground mt-1">Fill in the details below to place a lab test order</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Patient Selection */}
          <div>
            <Label className="mb-3 block flex items-center gap-2"><User className="h-4 w-4" /> Select Patient</Label>
            <div className="grid md:grid-cols-3 gap-3">
              {patients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPatient(p.id)}
                  className={`rounded-2xl border-2 p-4 text-left transition-all ${
                    selectedPatient === p.id ? "border-primary bg-primary/5 neon-glow-yellow" : "border-border hover:bg-accent"
                  }`}
                >
                  <p className="font-bold text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground">Case #{p.caseNumber}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Test Selection */}
          <div>
            <Label className="mb-3 block flex items-center gap-2"><FlaskConical className="h-4 w-4" /> Select Test</Label>
            <div className="space-y-2">
              {tests.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTest(t.id)}
                  className={`w-full flex items-center justify-between rounded-2xl border-2 p-4 transition-all ${
                    selectedTest === t.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                  }`}
                >
                  <span className="font-bold text-sm">{t.name}</span>
                  <span className="text-primary font-bold">${t.price}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Lab Selection */}
          <div>
            <Label className="mb-2 block flex items-center gap-2"><MapPin className="h-4 w-4" /> Preferred Lab</Label>
            <select
              value={selectedLab}
              onChange={(e) => setSelectedLab(e.target.value)}
              className="flex h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select a lab...</option>
              {labs.map((lab) => (
                <option key={lab} value={lab}>{lab}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <Label className="mb-2 block flex items-center gap-2"><Calendar className="h-4 w-4" /> Preferred Date & Time</Label>
            <Input type="datetime-local" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
          </div>

          {/* Notes */}
          <div>
            <Label className="mb-2 block flex items-center gap-2"><FileText className="h-4 w-4" /> Additional Notes</Label>
            <Textarea
              placeholder="Any special instructions or notes for the lab..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Submit */}
          <Button variant="neon" size="lg" className="w-full" onClick={handleSubmit} disabled={!selectedPatient || !selectedTest}>
            Place Order
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
