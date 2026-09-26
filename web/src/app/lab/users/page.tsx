import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Stethoscope, Heart } from "lucide-react";

export default function LabUsersPage() {
  const users = [
    { id: 1, name: "Dr. Anna Schmidt", role: "Doctor", specialty: "Cardiology", verified: true },
    { id: 2, name: "Dr. Mark Johnson", role: "Doctor", specialty: "General Medicine", verified: true },
    { id: 3, name: "Dr. Sarah Lee", role: "Doctor", specialty: "Dermatology", verified: true },
    { id: 4, name: "John Doe", role: "Patient", caseNumber: "MED-2026-04821", verified: false },
    { id: 5, name: "Jane Smith", role: "Patient", caseNumber: "MED-2026-03102", verified: false },
    { id: 6, name: "Emily Davis", role: "Patient", caseNumber: "MED-2026-05104", verified: false },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Directory</h1>
        <p className="text-sm text-muted-foreground mt-1">All registered doctors and patients</p>
      </div>

      <div className="space-y-3">
        {users.map((user) => (
          <Card key={user.id} className="beeline-card">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${user.role === "Doctor" ? "bg-primary/10" : "bg-accent-teal/10"} font-bold`}>
                  {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{user.name}</p>
                    {user.verified && (
                      <Badge variant="secondary" className="bg-accent-teal/10 text-accent-teal rounded-lg">Verified</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {user.role === "Doctor" ? `Doctor — ${user.specialty}` : `Patient — ${user.caseNumber}`}
                  </p>
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
