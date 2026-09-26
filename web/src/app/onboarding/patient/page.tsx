"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { User, Heart, Activity, AlertCircle } from "lucide-react";

export default function PatientOnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);

  // Personal info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [caseNumber] = useState(`MED-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [occupation, setOccupation] = useState("");

  // Emergency contact
  const [ecName, setEcName] = useState("");
  const [ecRelationship, setEcRelationship] = useState("");
  const [ecPhone, setEcPhone] = useState("");

  // Medical history
  const [complaint, setComplaint] = useState("");
  const [symptomOnset, setSymptomOnset] = useState("");
  const [symptomWorsening, setSymptomWorsening] = useState("");
  const [symptomRelief, setSymptomRelief] = useState("");
  const [symptomCharacter, setSymptomCharacter] = useState("");
  const [medications, setMedications] = useState("");
  const [woundLocation, setWoundLocation] = useState("");
  const [woundType, setWoundType] = useState("");
  const [woundCause, setWoundCause] = useState("");
  const [hasDiabetes, setHasDiabetes] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [hasHeartAttack, setHasHeartAttack] = useState(false);
  const [familyHistory, setFamilyHistory] = useState("");
  const [pastHistory, setPastHistory] = useState("");
  const [allergies, setAllergies] = useState("");
  const [smokingStatus, setSmokingStatus] = useState("");
  const [alcoholUse, setAlcoholUse] = useState("");
  const [physicalActivity, setPhysicalActivity] = useState("");
  const [sleepPattern, setSleepPattern] = useState("");
  const [mentalHealth, setMentalHealth] = useState("");
  const [immunization, setImmunization] = useState("");
  const [travelHistory, setTravelHistory] = useState("");
  const [occupationalExposure, setOccupationalExposure] = useState("");
  const [painScale, setPainScale] = useState("0");

  const bmi = height && weight ? (parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2)).toFixed(1) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate save — in production, POST to API
    setTimeout(() => {
      router.push("/dashboard");
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 md:pb-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 neon-glow">
          <User className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-primary neon-text">Patient Registration</h1>
        <p className="text-sm text-muted-foreground mt-1">Complete your profile to get started</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              Personal Information
            </CardTitle>
            <CardDescription>Basic demographic details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="middleName">Middle Name</Label>
                <Input id="middleName" value={middleName} onChange={(e) => setMiddleName(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="rounded-xl" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="caseNumber">Case Number</Label>
                <Input id="caseNumber" value={caseNumber} readOnly className="rounded-xl bg-muted font-mono text-primary" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender *</Label>
                <Select value={gender} onValueChange={(v) => setGender(v || "")}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} className="rounded-xl" rows={2} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input id="height" type="number" value={height} onChange={(e) => setHeight(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input id="weight" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>BMI</Label>
                <div className="flex h-10 items-center rounded-xl border border-border bg-muted px-3 text-sm font-semibold text-primary">
                  {bmi || "—"}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="occupation">Occupation</Label>
              <Input id="occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} className="rounded-xl" />
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5 text-accent-red" />
              Emergency Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="ecName">Contact Name *</Label>
                <Input id="ecName" value={ecName} onChange={(e) => setEcName(e.target.value)} required className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ecRelationship">Relationship</Label>
                <Input id="ecRelationship" value={ecRelationship} onChange={(e) => setEcRelationship(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ecPhone">Phone *</Label>
                <Input id="ecPhone" type="tel" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} required className="rounded-xl" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medical History */}
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Heart className="h-5 w-5 text-accent-teal" />
              Medical History
            </CardTitle>
            <CardDescription>Detailed clinical information for your care team</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="complaint">Chief Complaint</Label>
              <Textarea id="complaint" value={complaint} onChange={(e) => setComplaint(e.target.value)} className="rounded-xl" rows={2} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="symptomOnset">Symptom Onset</Label>
                <Input id="symptomOnset" value={symptomOnset} onChange={(e) => setSymptomOnset(e.target.value)} className="rounded-xl" placeholder="e.g., 3 days ago" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="symptomWorsening">Worsening Time</Label>
                <Input id="symptomWorsening" value={symptomWorsening} onChange={(e) => setSymptomWorsening(e.target.value)} className="rounded-xl" placeholder="e.g., at night" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="symptomRelief">Relief Time</Label>
                <Input id="symptomRelief" value={symptomRelief} onChange={(e) => setSymptomRelief(e.target.value)} className="rounded-xl" placeholder="e.g., after rest" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="symptomCharacter">Character</Label>
                <Input id="symptomCharacter" value={symptomCharacter} onChange={(e) => setSymptomCharacter(e.target.value)} className="rounded-xl" placeholder="e.g., sharp, dull" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="medications">Current Medications</Label>
              <Textarea id="medications" value={medications} onChange={(e) => setMedications(e.target.value)} className="rounded-xl" rows={2} />
            </div>

            {/* Wound/Injury */}
            <div className="rounded-xl border border-border p-4 space-y-3">
              <p className="text-sm font-semibold">Wound / Injury</p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="woundLocation">Location</Label>
                  <Input id="woundLocation" value={woundLocation} onChange={(e) => setWoundLocation(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="woundType">Type</Label>
                  <Input id="woundType" value={woundType} onChange={(e) => setWoundType(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="woundCause">Cause</Label>
                  <Input id="woundCause" value={woundCause} onChange={(e) => setWoundCause(e.target.value)} className="rounded-xl" />
                </div>
              </div>
            </div>

            {/* Chronic conditions */}
            <div className="space-y-3">
              {[
                { label: "History of Diabetes", value: hasDiabetes, setter: setHasDiabetes },
                { label: "History of Stroke", value: hasStroke, setter: setHasStroke },
                { label: "History of Heart Attack", value: hasHeartAttack, setter: setHasHeartAttack },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <Label className="text-sm">{item.label}</Label>
                  <Switch checked={item.value} onCheckedChange={item.setter} />
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="familyHistory">Family History</Label>
                <Textarea id="familyHistory" value={familyHistory} onChange={(e) => setFamilyHistory(e.target.value)} className="rounded-xl" rows={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pastHistory">Past Medical History</Label>
                <Textarea id="pastHistory" value={pastHistory} onChange={(e) => setPastHistory(e.target.value)} className="rounded-xl" rows={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="allergies">Allergies</Label>
                <Textarea id="allergies" value={allergies} onChange={(e) => setAllergies(e.target.value)} className="rounded-xl" rows={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mentalHealth">Mental Health</Label>
                <Textarea id="mentalHealth" value={mentalHealth} onChange={(e) => setMentalHealth(e.target.value)} className="rounded-xl" rows={2} />
              </div>
            </div>

            {/* Lifestyle */}
            <div className="rounded-xl border border-border p-4 space-y-3">
              <p className="text-sm font-semibold">Lifestyle</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smoking">Smoking Status</Label>
                  <Select value={smokingStatus} onValueChange={(v) => setSmokingStatus(v || "")}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="current">Current</SelectItem>
                      <SelectItem value="former">Former</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alcohol">Alcohol Use</Label>
                  <Select value={alcoholUse} onValueChange={(v) => setAlcoholUse(v || "")}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="occasional">Occasional</SelectItem>
                      <SelectItem value="regular">Regular</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activity">Physical Activity</Label>
                  <Select value={physicalActivity} onValueChange={(v) => setPhysicalActivity(v || "")}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sedentary">Sedentary</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sleep">Sleep Pattern</Label>
                  <Select value={sleepPattern} onValueChange={(v) => setSleepPattern(v || "")}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="immunization">Immunization History</Label>
                <Textarea id="immunization" value={immunization} onChange={(e) => setImmunization(e.target.value)} className="rounded-xl" rows={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="travel">Travel History</Label>
                <Textarea id="travel" value={travelHistory} onChange={(e) => setTravelHistory(e.target.value)} className="rounded-xl" rows={2} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="occExposure">Occupational Exposure</Label>
              <Textarea id="occExposure" value={occupationalExposure} onChange={(e) => setOccupationalExposure(e.target.value)} className="rounded-xl" rows={2} />
            </div>

            {/* Pain Scale */}
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Pain Scale (0-10)</Label>
                <span className="text-2xl font-bold text-primary">{painScale}</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={painScale}
                onChange={(e) => setPainScale(e.target.value)}
                className="w-full accent-yellow-400"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>No pain</span>
                <span>Worst pain</span>
              </div>
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
