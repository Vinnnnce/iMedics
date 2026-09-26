"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { Stethoscope, BadgeCheck, Upload, Calendar } from "lucide-react";

const SPECIALTIES = [
  "Cardiology", "Dermatology", "Endocrinology", "Gastroenterology",
  "General Medicine", "Neurology", "Obstetrics & Gynecology",
  "Oncology", "Orthopedics", "Pediatrics", "Psychiatry",
  "Pulmonology", "Radiology", "Surgery", "Urology",
];

export default function DoctorOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [biography, setBiography] = useState("");
  const [expertise, setExpertise] = useState<string[]>([]);
  const [expertiseInput, setExpertiseInput] = useState("");
  const [aiToolsEnabled, setAiToolsEnabled] = useState(false);
  const [documents, setDocuments] = useState<string[]>([]);

  const addExpertise = () => {
    const val = expertiseInput.trim();
    if (val && !expertise.includes(val)) {
      setExpertise([...expertise, val]);
      setExpertiseInput("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => router.push("/dashboard"), 1500);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24 md:pb-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 neon-glow">
          <Stethoscope className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-primary neon-text">Doctor Registration</h1>
        <p className="text-sm text-muted-foreground mt-1">Complete your professional profile</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Info */}
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Stethoscope className="h-5 w-5 text-primary" />
              Personal Information
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
              <Label htmlFor="gender">Gender</Label>
              <Select value={gender} onValueChange={(v) => setGender(v || "")}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Professional Info */}
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BadgeCheck className="h-5 w-5 text-accent-teal" />
              Professional Credentials
            </CardTitle>
            <CardDescription>Your medical license and practice details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="license">Medical License Number *</Label>
                <Input id="license" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} required className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="years">Years of Experience</Label>
                <Input id="years" type="number" value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} className="rounded-xl" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="specialty">Specialty *</Label>
                <Select value={specialty} onValueChange={(v) => setSpecialty(v || "")}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select specialty" /></SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="affiliation">Clinic/Hospital Affiliation</Label>
                <Input id="affiliation" value={affiliation} onChange={(e) => setAffiliation(e.target.value)} className="rounded-xl" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Short Biography</Label>
              <Textarea id="bio" value={biography} onChange={(e) => setBiography(e.target.value)} className="rounded-xl" rows={3} />
            </div>

            {/* Areas of Expertise */}
            <div className="space-y-2">
              <Label>Areas of Expertise</Label>
              <div className="flex gap-2">
                <Input
                  value={expertiseInput}
                  onChange={(e) => setExpertiseInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExpertise(); } }}
                  placeholder="Type and press Enter"
                  className="rounded-xl"
                />
                <Button type="button" onClick={addExpertise} variant="outline" className="rounded-xl">Add</Button>
              </div>
              {expertise.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {expertise.map((tag) => (
                    <Badge key={tag} variant="secondary" className="rounded-lg bg-primary/10 text-primary">
                      {tag}
                      <button type="button" onClick={() => setExpertise(expertise.filter((e) => e !== tag))} className="ml-2">
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Document Upload */}
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-5 w-5 text-accent-blue" />
              Verification Documents
            </CardTitle>
            <CardDescription>Upload your medical license and ID for verification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary/30 transition-colors">
                <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Medical License</p>
                <p className="text-xs text-muted-foreground">PDF, JPG, PNG</p>
                <Button type="button" variant="outline" size="sm" className="mt-3 rounded-xl">Upload</Button>
              </div>
              <div className="rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary/30 transition-colors">
                <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Government ID</p>
                <p className="text-xs text-muted-foreground">PDF, JPG, PNG</p>
                <Button type="button" variant="outline" size="sm" className="mt-3 rounded-xl">Upload</Button>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="text-sm font-medium">AI-Driven Consultation Tools</p>
                <p className="text-xs text-muted-foreground">Enable AI-assisted diagnosis and recommendations</p>
              </div>
              <Switch checked={aiToolsEnabled} onCheckedChange={setAiToolsEnabled} />
            </div>
          </CardContent>
        </Card>

        {/* Verification Badge Notice */}
        <div className="flex items-center gap-3 rounded-xl border border-accent-teal/30 bg-accent-teal/5 p-4">
          <BadgeCheck className="h-5 w-5 text-accent-teal shrink-0" />
          <p className="text-xs text-muted-foreground">
            A verification badge will appear on your profile once your credentials are verified by our team.
          </p>
        </div>

        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 neon-glow rounded-xl h-12 text-base font-bold" disabled={loading}>
          {loading ? "Saving..." : "Complete Registration"}
        </Button>
      </form>
    </div>
  );
}
