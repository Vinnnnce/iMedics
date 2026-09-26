"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, UserMinus, Building2 } from "lucide-react";

export default function DoctorAdmitPage() {
  const admitted = [
    { id: 1, name: "John Doe", room: "Ward A - Bed 12", admitted: "Sep 20", status: "Admitted" },
    { id: 2, name: "Jane Smith", room: "Ward B - Bed 5", admitted: "Sep 22", status: "Admitted" },
    { id: 3, name: "Robert Brown", room: "Ward A - Bed 8", admitted: "Sep 18", status: "Discharged" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admit / Discharge</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage patient admissions and discharges</p>
      </div>

      {/* Admit new patient */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5 text-accent-teal" />
            Admit New Patient
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Patient Name</p>
              <p className="text-sm font-medium">Select from roster</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ward / Room</p>
              <p className="text-sm font-medium">Auto-assign</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Admission Date</p>
              <p className="text-sm font-medium">Today</p>
            </div>
          </div>
          <Button className="mt-4 bg-accent-teal text-white rounded-xl">
            <UserPlus className="h-4 w-4 mr-1" /> Admit Patient
          </Button>
        </CardContent>
      </Card>

      {/* Current admissions */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" />
            Current Admissions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {admitted.map((patient) => (
            <div key={patient.id} className="flex items-center justify-between rounded-xl border border-border p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
                  {patient.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-medium">{patient.name}</p>
                  <p className="text-xs text-muted-foreground">{patient.room} — Admitted: {patient.admitted}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={patient.status === "Admitted" ? "secondary" : "outline"} className={patient.status === "Admitted" ? "bg-accent-teal/10 text-accent-teal rounded-lg" : "rounded-lg"}>
                  {patient.status}
                </Badge>
                {patient.status === "Admitted" && (
                  <Button size="sm" variant="outline" className="rounded-xl text-destructive">
                    <UserMinus className="h-4 w-4 mr-1" /> Discharge
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
