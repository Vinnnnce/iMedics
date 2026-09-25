"use client";
import Link from "next/link";
import { FlaskConical, Calendar, FileText, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const results = [
  { id: "1", name: "Complete Blood Count (CBC)", date: "Sep 20, 2024", lab: "Central Lab", status: "ready", doctor: "Dr. Sarah Chen" },
  { id: "2", name: "Lipid Panel", date: "Sep 18, 2024", lab: "Central Lab", status: "in-progress", doctor: "Dr. Sarah Chen" },
  { id: "3", name: "Comprehensive Metabolic Panel", date: "Sep 15, 2024", lab: "MedLab Express", status: "ready", doctor: "Dr. James Park" },
  { id: "4", name: "Thyroid Function Test", date: "Sep 10, 2024", lab: "BioDiagnostics", status: "ready", doctor: "Dr. Emily Watson" },
  { id: "5", name: "Urinalysis", date: "Sep 5, 2024", lab: "Central Lab", status: "ready", doctor: "Dr. Sarah Chen" },
];

export default function LabResultsList() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-extrabold">Lab Test Results</h1>
        <p className="text-muted-foreground mt-1">View and track your lab test results</p>
      </div>

      <div className="space-y-3">
        {results.map((result) => (
          <Link key={result.id} href={`/lab-tests/results/${result.id}`}>
            <Card className="group cursor-pointer hover:shadow-neon transition-all hover:-translate-y-0.5">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
                  <FlaskConical className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate">{result.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {result.date}</span>
                    <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {result.lab}</span>
                    <span>· {result.doctor}</span>
                  </div>
                </div>
                <Badge variant={result.status === "ready" ? "success" : "warning"}>
                  {result.status === "ready" ? "Ready" : "In Progress"}
                </Badge>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
