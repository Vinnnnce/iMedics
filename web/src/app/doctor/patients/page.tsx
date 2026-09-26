import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Plus } from "lucide-react";

export default function DoctorPatientsPage() {
  const patients = [
    { id: 1, name: "John Doe", age: 36, lastVisit: "Sep 12, 2026", status: "Active", case: "MED-2026-04821" },
    { id: 2, name: "Jane Smith", age: 42, lastVisit: "Sep 8, 2026", status: "Active", case: "MED-2026-03102" },
    { id: 3, name: "Robert Brown", age: 55, lastVisit: "Aug 30, 2026", status: "Discharged", case: "MED-2026-02893" },
    { id: 4, name: "Emily Davis", age: 28, lastVisit: "Aug 25, 2026", status: "Active", case: "MED-2026-05104" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Patients</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your patient roster</p>
        </div>
        <Button className="bg-primary text-primary-foreground rounded-xl">
          <Plus className="h-4 w-4 mr-1" /> Add Patient
        </Button>
      </div>

      <div className="space-y-3">
        {patients.map((patient) => (
          <Card key={patient.id} className="beeline-card">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold">
                  {patient.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{patient.name}</p>
                    <Badge variant={patient.status === "Active" ? "secondary" : "outline"} className={patient.status === "Active" ? "bg-accent-teal/10 text-accent-teal rounded-lg" : "rounded-lg"}>
                      {patient.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Age {patient.age} — Case: {patient.case}</p>
                  <p className="text-xs text-muted-foreground">Last visit: {patient.lastVisit}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="rounded-xl">View</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
