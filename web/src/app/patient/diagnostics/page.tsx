import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Activity, Brain, Eye } from "lucide-react";

export default function PatientDiagnosticsPage() {
  const diagnostics = [
    { id: 1, name: "ECG (Electrocardiogram)", date: "Sep 12, 2026", status: "Normal", icon: Heart, color: "text-destructive", bg: "bg-muted" },
    { id: 2, name: "Chest X-Ray", date: "Sep 8, 2026", status: "Clear", icon: Eye, color: "text-muted-foreground", bg: "bg-muted" },
    { id: 3, name: "CT Scan — Head", date: "Aug 30, 2026", status: "Normal", icon: Brain, color: "text-foreground", bg: "bg-foreground/10" },
    { id: 4, name: "Ultrasound — Abdomen", date: "Aug 25, 2026", status: "Normal", icon: Activity, color: "text-muted-foreground", bg: "bg-muted" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Diagnostics</h1>
        <p className="text-sm text-muted-foreground mt-1">View your diagnostic test results</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {diagnostics.map((diag) => {
          const Icon = diag.icon;
          return (
            <Card key={diag.id} className="beeline-card">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${diag.bg}`}>
                  <Icon className={`h-6 w-6 ${diag.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{diag.name}</p>
                  <p className="text-xs text-muted-foreground">{diag.date} — {diag.status}</p>
                </div>
                <Button size="sm" variant="outline" className="rounded-lg">View</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
