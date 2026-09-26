import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pill, Download } from "lucide-react";

export default function PatientPrescriptionsPage() {
  const prescriptions = [
    { id: 1, doctor: "Dr. Anna Schmidt", date: "Sep 12, 2026", meds: "Ibuprofen 400mg, Omeprazole 20mg", status: "Active" },
    { id: 2, doctor: "Dr. Mark Johnson", date: "Aug 20, 2026", meds: "Amoxicillin 500mg", status: "Completed" },
    { id: 3, doctor: "Dr. Anna Schmidt", date: "Jul 15, 2026", meds: "Metformin 500mg", status: "Active" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Prescriptions</h1>
        <p className="text-sm text-muted-foreground mt-1">Your medication history</p>
      </div>

      <div className="space-y-3">
        {prescriptions.map((rx) => (
          <Card key={rx.id} className="beeline-card">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Pill className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{rx.meds}</p>
                  <p className="text-xs text-muted-foreground">{rx.doctor} — {rx.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={rx.status === "Active" ? "secondary" : "outline"} className={rx.status === "Active" ? "bg-accent-teal/10 text-accent-teal rounded-lg" : "rounded-lg"}>
                  {rx.status}
                </Badge>
                <Button size="sm" variant="outline" className="rounded-xl">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
