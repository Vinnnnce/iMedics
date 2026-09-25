"use client";
import Link from "next/link";
import { User, Phone, MapPin, Briefcase, Heart, AlertCircle, FileText, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function PatientProfile() {
  const patient = {
    caseNumber: "MED-1905-2024",
    firstName: "John",
    lastName: "Anderson",
    middleName: "Robert",
    gender: "Male",
    dob: "1985-03-15",
    address: "123 Main Street, Warsaw, Poland",
    phone: "+48 123 456 789",
    email: "john.anderson@email.com",
    height: 178,
    weight: 75,
    bmi: 23.7,
    occupation: "Software Engineer",
    bloodType: "O+",
    emergencyName: "Jane Anderson",
    emergencyPhone: "+48 987 654 321",
    emergencyRelation: "Spouse",
    insuranceNumber: "INS-789456123",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy-light p-6">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/15 text-primary text-2xl font-bold">
            {patient.firstName[0]}{patient.lastName[0]}
          </div>
          <div>
            <Badge variant="neon" className="mb-1">Case #{patient.caseNumber}</Badge>
            <h1 className="font-display text-2xl font-extrabold">{patient.firstName} {patient.middleName} {patient.lastName}</h1>
            <p className="text-sm text-muted-foreground">{patient.gender} · {patient.bloodType} · BMI: {patient.bmi}</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Full Name" value={`${patient.firstName} ${patient.middleName} ${patient.lastName}`} />
            <InfoRow label="Date of Birth" value={patient.dob} />
            <InfoRow label="Gender" value={patient.gender} />
            <InfoRow label="Blood Type" value={patient.bloodType} />
            <InfoRow label="Case Number" value={patient.caseNumber} />
            <InfoRow label="Insurance Number" value={patient.insuranceNumber} />
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-secondary" /> Contact & Address
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Phone" value={patient.phone} icon={<Phone className="h-4 w-4" />} />
            <InfoRow label="Email" value={patient.email} />
            <InfoRow label="Address" value={patient.address} icon={<MapPin className="h-4 w-4" />} />
          </CardContent>
        </Card>

        {/* Medical ID */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" /> Medical ID
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-muted/50 p-4 text-center">
                <p className="text-xs text-muted-foreground">Height</p>
                <p className="font-display text-xl font-bold">{patient.height}</p>
                <p className="text-xs text-muted-foreground">cm</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-4 text-center">
                <p className="text-xs text-muted-foreground">Weight</p>
                <p className="font-display text-xl font-bold">{patient.weight}</p>
                <p className="text-xs text-muted-foreground">kg</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-4 text-center neon-glow-yellow">
                <p className="text-xs text-muted-foreground">BMI</p>
                <p className="font-display text-xl font-bold text-primary">{patient.bmi}</p>
                <p className="text-xs text-primary">Normal</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact & Occupation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-400" /> Emergency & Occupation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Emergency Contact" value={patient.emergencyName} />
            <InfoRow label="Relationship" value={patient.emergencyRelation} />
            <InfoRow label="Emergency Phone" value={patient.emergencyPhone} />
            <Separator />
            <InfoRow label="Occupation" value={patient.occupation} icon={<Briefcase className="h-4 w-4" />} />
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/patients/medical-history">
          <Button variant="neon">
            <FileText className="mr-2 h-4 w-4" /> Medical History
          </Button>
        </Link>
        <Link href="/patients/timeline">
          <Button variant="outline">
            <Activity className="mr-2 h-4 w-4" /> View Timeline
          </Button>
        </Link>
        <Button variant="ghost">Edit Profile</Button>
      </div>
    </div>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-bold flex items-center gap-1.5">{icon}{value}</span>
    </div>
  );
}
