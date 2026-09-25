"use client";
import Link from "next/link";
import { ArrowLeft, FlaskConical, Image, FileText, Brain, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, User, Hash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function DiagnosticsDetail({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <Link href="/diagnostics">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Overview
        </Button>
      </Link>

      {/* Header */}
      <Card className="overflow-hidden">
        <div className="relative bg-gradient-to-br from-navy to-navy-light p-6">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="neon">Case #DIAG-1905-001</Badge>
              <Badge variant="teal">In Review</Badge>
              <Badge variant="warning">Needs Attention</Badge>
            </div>
            <h1 className="font-display text-2xl font-extrabold">John Anderson</h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><User className="h-4 w-4" /> 39yo Male</span>
              <span className="flex items-center gap-1"><Hash className="h-4 w-4" /> Case #MED-1905-2024</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Lab Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-secondary" /> Lab Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: "White Blood Cells", value: "6.8 10^3/μL", refRange: "4.5 - 11.0", status: "normal" },
            { name: "Hemoglobin", value: "13.8 g/dL", refRange: "13.5 - 17.5", status: "normal" },
            { name: "Platelets", value: "145 10^3/μL", refRange: "150 - 400", status: "low" },
            { name: "Total Cholesterol", value: "215 mg/dL", refRange: "< 200", status: "high" },
            { name: "LDL", value: "142 mg/dL", refRange: "< 100", status: "high" },
            { name: "HDL", value: "48 mg/dL", refRange: "> 40", status: "normal" },
            { name: "Glucose (Fasting)", value: "95 mg/dL", refRange: "70 - 100", status: "normal" },
            { name: "TSH", value: "2.4 mIU/L", refRange: "0.4 - 4.0", status: "normal" },
          ].map((val, i) => (
            <div key={i} className="flex items-center justify-between rounded-2xl bg-muted/50 p-3">
              <div>
                <p className="text-sm font-bold">{val.name}</p>
                <p className="text-xs text-muted-foreground">Ref: {val.refRange}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${val.status === "high" ? "text-red-400" : val.status === "low" ? "text-orange-400" : "text-green-400"}`}>
                  {val.value}
                </span>
                {val.status === "normal" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                ) : val.status === "high" ? (
                  <Badge variant="destructive"><TrendingUp className="mr-1 h-3 w-3" /> High</Badge>
                ) : (
                  <Badge variant="warning"><TrendingDown className="mr-1 h-3 w-3" /> Low</Badge>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Imaging Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-purple-400" /> Imaging Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { modality: "Chest X-Ray", date: "Sep 15, 2024", findings: "No acute cardiopulmonary findings. Heart size normal. Lungs are clear.", status: "reported" },
            { modality: "Abdominal Ultrasound", date: "Sep 8, 2024", findings: "Liver, gallbladder, and kidneys appear normal. No evidence of masses or stones.", status: "reported" },
          ].map((img, i) => (
            <div key={i} className="rounded-2xl bg-muted/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                    <Image className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{img.modality}</p>
                    <p className="text-xs text-muted-foreground">{img.date}</p>
                  </div>
                </div>
                <Badge variant="success">{img.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{img.findings}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Clinical Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Clinical Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { type: "Assessment", author: "Dr. Sarah Chen", date: "Sep 20, 2024", content: "Patient presents with mild thrombocytopenia and elevated cholesterol. Overall cardiovascular risk is moderate. Recommend lifestyle modifications and statin therapy consideration." },
            { type: "Progress", author: "Dr. James Park", date: "Sep 15, 2024", content: "Patient reports feeling well. No new complaints. Blood pressure stable at 128/82." },
            { type: "Plan", author: "Dr. Sarah Chen", date: "Sep 10, 2024", content: "1. Repeat CBC in 4 weeks. 2. Start lipid-lowering therapy. 3. Lifestyle counseling: diet and exercise. 4. Follow-up in 3 months." },
          ].map((note, i) => (
            <div key={i} className="rounded-2xl bg-muted/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <Badge variant={note.type === "Assessment" ? "neon" : note.type === "Progress" ? "teal" : "outline"}>{note.type}</Badge>
                <span className="text-xs text-muted-foreground">{note.author} · {note.date}</span>
              </div>
              <p className="text-sm text-muted-foreground">{note.content}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* AI Summary */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl neon-gradient">
              <Brain className="h-4 w-4 text-navy" />
            </div>
            AI Diagnostic Summary
            <Badge variant="neon">Kimi K3</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed">
            This 39-year-old male patient presents with mild thrombocytopenia (platelets: 145 10^3/μL) and dyslipidemia (Total Cholesterol: 215 mg/dL, LDL: 142 mg/dL). The remaining lab values, including CBC parameters, glucose, and thyroid function, are within normal limits. Imaging studies (chest X-ray and abdominal ultrasound) show no acute abnormalities.
          </p>
          <p className="text-sm leading-relaxed">
            The combination of elevated LDL and slightly low platelets warrants monitoring. Cardiovascular risk is moderate given the lipid profile. The clinical plan to repeat CBC, initiate lipid-lowering therapy, and implement lifestyle modifications is appropriate. Follow-up in 3 months is recommended.
          </p>
          <Separator />
          <div className="flex items-start gap-2 rounded-2xl bg-orange-500/10 p-3">
            <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              This AI-generated summary is assistive only and does not constitute a medical diagnosis. It is intended to support, not replace, clinical judgment. Always verify findings with the original data.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/diagnostics/workspace/1">
          <Button variant="neon" size="lg">
            <FileText className="mr-2 h-5 w-5" /> Open Workspace
          </Button>
        </Link>
        <Button variant="outline" size="lg">Export Case</Button>
      </div>
    </div>
  );
}
