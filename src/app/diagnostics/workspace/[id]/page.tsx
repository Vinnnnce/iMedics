"use client";
import { FlaskConical, Image, FileText, Brain, Save, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function DoctorDiagnosticsWorkspace({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl md:text-2xl font-extrabold">Diagnostic Workspace</h1>
          <p className="text-sm text-muted-foreground">Case #DIAG-1905-001 · John Anderson</p>
        </div>
        <Button variant="neon" size="sm">
          <Save className="mr-2 h-4 w-4" /> Save Notes
        </Button>
      </div>

      {/* Side-by-side Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column: Lab Values & History */}
        <div className="space-y-6">
          {/* Lab Values */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FlaskConical className="h-4 w-4 text-secondary" /> Lab Values
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { name: "WBC", value: "6.8", unit: "10^3/μL", ref: "4.5-11.0", status: "normal" },
                { name: "Hemoglobin", value: "13.8", unit: "g/dL", ref: "13.5-17.5", status: "normal" },
                { name: "Platelets", value: "145", unit: "10^3/μL", ref: "150-400", status: "low" },
                { name: "Total Cholesterol", value: "215", unit: "mg/dL", ref: "<200", status: "high" },
                { name: "LDL", value: "142", unit: "mg/dL", ref: "<100", status: "high" },
                { name: "HDL", value: "48", unit: "mg/dL", ref: ">40", status: "normal" },
                { name: "Glucose", value: "95", unit: "mg/dL", ref: "70-100", status: "normal" },
                { name: "TSH", value: "2.4", unit: "mIU/L", ref: "0.4-4.0", status: "normal" },
              ].map((val, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
                  <div>
                    <p className="text-xs font-bold">{val.name}</p>
                    <p className="text-[10px] text-muted-foreground">Ref: {val.ref} {val.unit}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${val.status === "high" ? "text-red-400" : val.status === "low" ? "text-orange-400" : "text-green-400"}`}>
                      {val.value}
                    </span>
                    {val.status === "normal" ? (
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                    ) : val.status === "high" ? (
                      <TrendingUp className="h-3 w-3 text-red-400" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-orange-400" />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Patient History Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" /> Patient History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs font-bold mb-1">Chief Complaint</p>
                <p className="text-xs text-muted-foreground">Routine follow-up for elevated cholesterol</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs font-bold mb-1">Past Medical History</p>
                <p className="text-xs text-muted-foreground">No diabetes, no stroke, no heart attack. Family history: father with hypertension.</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs font-bold mb-1">Current Medications</p>
                <p className="text-xs text-muted-foreground">None currently</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs font-bold mb-1">Lifestyle</p>
                <p className="text-xs text-muted-foreground">Former smoker, occasional alcohol, moderate activity</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Imaging & Notes */}
        <div className="space-y-6">
          {/* Imaging Reports */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Image className="h-4 w-4 text-purple-400" /> Imaging Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl bg-muted/50 p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold">Chest X-Ray</p>
                  <Badge variant="success" className="text-[10px]">Reported</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">No acute cardiopulmonary findings. Heart size normal.</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold">Abdominal Ultrasound</p>
                  <Badge variant="success" className="text-[10px]">Reported</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">Liver, gallbladder, kidneys normal. No masses.</p>
              </div>
            </CardContent>
          </Card>

          {/* Notes Editor */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" /> Clinical Notes Editor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="mb-2 block text-xs">Note Type</Label>
                <div className="flex gap-2">
                  {["Progress", "Assessment", "Plan", "Observation"].map((type) => (
                    <button key={type} className="rounded-xl bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-primary hover:text-navy transition-all">
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-2 block text-xs">Note Content</Label>
                <Textarea
                  placeholder="Write your clinical note here..."
                  className="min-h-[120px]"
                />
              </div>
              <Button variant="neon" size="sm" className="w-full">
                <Save className="mr-2 h-4 w-4" /> Add Note
              </Button>
            </CardContent>
          </Card>

          {/* AI Summary */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg neon-gradient">
                  <Brain className="h-3 w-3 text-navy" />
                </div>
                AI Summary
                <Badge variant="neon" className="text-[10px]">Kimi K3</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Mild thrombocytopenia (145 vs 150-400) and dyslipidemia (LDL 142, TC 215) noted. Remaining labs normal. Imaging unremarkable. Recommend statin therapy, lifestyle changes, and CBC repeat in 4 weeks.
              </p>
              <div className="mt-3 flex items-start gap-1.5 rounded-xl bg-orange-500/10 p-2">
                <AlertTriangle className="h-3 w-3 text-orange-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground">AI assistive only — verify with original data.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
