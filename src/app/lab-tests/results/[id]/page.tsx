"use client";
import { FlaskConical, Calendar, Building2, Brain, FileText, Download, MessageSquare, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const result = {
  testName: "Complete Blood Count (CBC)",
  date: "September 20, 2024",
  lab: "Central Laboratory",
  doctor: "Dr. Sarah Chen",
  values: [
    { name: "White Blood Cells", value: 6.8, unit: "10^3/μL", refRange: "4.5 - 11.0", status: "normal" },
    { name: "Red Blood Cells", value: 4.52, unit: "10^6/μL", refRange: "4.5 - 5.9", status: "normal" },
    { name: "Hemoglobin", value: 13.8, unit: "g/dL", refRange: "13.5 - 17.5", status: "normal" },
    { name: "Hematocrit", value: 41.2, unit: "%", refRange: "41.0 - 53.0", status: "normal" },
    { name: "Platelets", value: 145, unit: "10^3/μL", refRange: "150 - 400", status: "low" },
    { name: "Neutrophils", value: 58, unit: "%", refRange: "45 - 70", status: "normal" },
    { name: "Lymphocytes", value: 32, unit: "%", refRange: "20 - 40", status: "normal" },
    { name: "Monocytes", value: 7, unit: "%", refRange: "2 - 10", status: "normal" },
  ],
  aiInterpretation: "The CBC results show most values within normal reference ranges. However, platelet count is slightly below the lower reference limit (145 vs 150-400 10^3/μL), which may indicate mild thrombocytopenia. This finding is not immediately concerning but warrants monitoring. Clinical correlation with patient history and symptoms is recommended. A repeat test in 4-6 weeks may be considered to track the trend.",
  attachments: [
    { name: "CBC_Report_Full.pdf", type: "PDF", size: "245 KB" },
    { name: "Lab_Certificate.pdf", type: "PDF", size: "128 KB" },
  ],
};

export default function LabResultDetail({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <Card className="overflow-hidden">
        <div className="relative bg-gradient-to-br from-navy to-navy-light p-6">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="neon">Result Ready</Badge>
              <Badge variant="teal">Central Lab</Badge>
            </div>
            <h1 className="font-display text-2xl font-extrabold">{result.testName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {result.date}</span>
              <span className="flex items-center gap-1"><Building2 className="h-4 w-4" /> {result.lab}</span>
              <span>· {result.doctor}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Numeric Values Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" /> Test Values
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 text-xs font-bold uppercase text-muted-foreground">Parameter</th>
                  <th className="text-right py-3 px-2 text-xs font-bold uppercase text-muted-foreground">Value</th>
                  <th className="text-right py-3 px-2 text-xs font-bold uppercase text-muted-foreground">Unit</th>
                  <th className="text-right py-3 px-2 text-xs font-bold uppercase text-muted-foreground">Ref Range</th>
                  <th className="text-center py-3 px-2 text-xs font-bold uppercase text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.values.map((val, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-3 px-2 text-sm font-medium">{val.name}</td>
                    <td className={`py-3 px-2 text-right text-sm font-bold ${val.status === "high" ? "text-red-400" : val.status === "low" ? "text-orange-400" : "text-green-400"}`}>
                      {val.value}
                    </td>
                    <td className="py-3 px-2 text-right text-xs text-muted-foreground">{val.unit}</td>
                    <td className="py-3 px-2 text-right text-xs text-muted-foreground">{val.refRange}</td>
                    <td className="py-3 px-2 text-center">
                      {val.status === "normal" ? (
                        <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" /> Normal</Badge>
                      ) : val.status === "high" ? (
                        <Badge variant="destructive"><TrendingUp className="mr-1 h-3 w-3" /> High</Badge>
                      ) : (
                        <Badge variant="warning"><TrendingDown className="mr-1 h-3 w-3" /> Low</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* AI Interpretation */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl neon-gradient">
              <Brain className="h-4 w-4 text-navy" />
            </div>
            AI Interpretation
            <Badge variant="neon">Kimi K3</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{result.aiInterpretation}</p>
          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-orange-500/10 p-3">
            <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              This AI-generated interpretation is assistive only and does not replace professional medical advice. Always consult with your doctor.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-secondary" /> Attachments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {result.attachments.map((file, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">{file.name}</p>
                <p className="text-xs text-muted-foreground">{file.type} · {file.size}</p>
              </div>
              <Button variant="ghost" size="sm">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="flex flex-wrap gap-3">
        <Button variant="neon" size="lg">
          <MessageSquare className="mr-2 h-5 w-5" /> Discuss with Doctor
        </Button>
        <Button variant="outline" size="lg">
          <Download className="mr-2 h-5 w-5" /> Download Report
        </Button>
      </div>
    </div>
  );
}
