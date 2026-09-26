"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { FlaskConical, Upload, Building2 } from "lucide-react";

const DEPARTMENTS = [
  "Hematology",
  "Microbiology",
  "Chemical Pathology",
  "Histopathology",
  "Imaging (X-ray, CT, Ultrasound)",
  "Stool Analysis/Culture",
  "Swab Tests",
];

const POSITIONS = ["Technician", "Scientist", "Supervisor"];

export default function LabOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [labName, setLabName] = useState("");
  const [position, setPosition] = useState("");
  const [licenseId, setLicenseId] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);

  const toggleDept = (dept: string) => {
    setSelectedDepts((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => router.push("/dashboard"), 1500);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 md:pb-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-blue/10">
          <FlaskConical className="h-7 w-7 text-accent-blue" />
        </div>
        <h1 className="text-2xl font-bold text-primary neon-text">Lab Staff Registration</h1>
        <p className="text-sm text-muted-foreground mt-1">Complete your laboratory profile</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary" />
              Personal & Lab Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="rounded-xl" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="labName">Laboratory Name *</Label>
              <Input id="labName" value={labName} onChange={(e) => setLabName(e.target.value)} required className="rounded-xl" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="position">Position *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {POSITIONS.map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setPosition(pos)}
                      className={`rounded-xl border-2 p-2 text-xs font-medium transition-colors ${
                        position === pos ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="licenseId">License/ID Number *</Label>
                <Input id="licenseId" value={licenseId} onChange={(e) => setLicenseId(e.target.value)} required className="rounded-xl" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Departments */}
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FlaskConical className="h-5 w-5 text-accent-teal" />
              Departments Handled
            </CardTitle>
            <CardDescription>Select all departments you work with</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {DEPARTMENTS.map((dept) => (
                <div
                  key={dept}
                  className={`flex items-center justify-between rounded-xl border-2 p-3 transition-colors cursor-pointer ${
                    selectedDepts.includes(dept) ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                  }`}
                  onClick={() => toggleDept(dept)}
                >
                  <span className="text-sm font-medium">{dept}</span>
                  <Switch checked={selectedDepts.includes(dept)} />
                </div>
              ))}
            </div>
            {selectedDepts.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {selectedDepts.map((d) => (
                  <Badge key={d} variant="secondary" className="rounded-lg bg-accent-teal/10 text-accent-teal">
                    {d}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Document Upload */}
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-5 w-5 text-accent-blue" />
              Verification Documents
            </CardTitle>
            <CardDescription>Upload your lab license and certification</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary/30 transition-colors">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Lab License & Certification</p>
              <p className="text-xs text-muted-foreground">PDF, JPG, PNG</p>
              <Button type="button" variant="outline" size="sm" className="mt-3 rounded-xl">Upload</Button>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 neon-glow rounded-xl h-12 text-base font-bold" disabled={loading}>
          {loading ? "Saving..." : "Complete Registration"}
        </Button>
      </form>
    </div>
  );
}
