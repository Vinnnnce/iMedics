import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, User, Phone, MapPin, Briefcase } from "lucide-react";

export default function PatientCaseFilePage() {
  const caseInfo = [
    { label: "Case Number", value: "MED-2026-04821", icon: FileText },
    { label: "Full Name", value: "John Doe", icon: User },
    { label: "Gender", value: "Male", icon: User },
    { label: "Date of Birth", value: "Jan 15, 1990", icon: User },
    { label: "Height / Weight", value: "175 cm / 70 kg (BMI: 22.9)", icon: User },
    { label: "Occupation", value: "Software Engineer", icon: Briefcase },
    { label: "Address", value: "123 Main St, Warsaw, PL", icon: MapPin },
    { label: "Emergency Contact", value: "Jane Doe (Spouse) — +48 123 456 789", icon: Phone },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Case File</h1>
        <p className="text-sm text-muted-foreground mt-1">Your complete medical profile</p>
      </div>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Patient Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {caseInfo.map((info) => {
              const Icon = info.icon;
              return (
                <div key={info.label} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{info.label}</p>
                    <p className="text-sm font-medium">{info.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Medical Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">Chief Complaint</p>
            <p className="text-sm font-medium mt-1">Recurring headaches and fatigue over the past 2 weeks</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">Current Medications</p>
            <p className="text-sm font-medium mt-1">Ibuprofen 400mg as needed</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">Allergies</p>
            <p className="text-sm font-medium mt-1">Penicillin</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
