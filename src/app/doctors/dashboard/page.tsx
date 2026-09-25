"use client";
import Link from "next/link";
import { Calendar, FlaskConical, MessageSquare, Users, FlaskConical as Lab, Activity, Settings, Stethoscope, Clock, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/shared/stat-tile";

export default function DoctorDashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy-light p-6">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/15 text-primary">
            <Stethoscope className="h-8 w-8" />
          </div>
          <div>
            <Badge variant="neon" className="mb-1">Doctor Dashboard</Badge>
            <h1 className="font-display text-2xl font-extrabold">Dr. Sarah Chen</h1>
            <p className="text-sm text-muted-foreground">Cardiology · 12 years experience</p>
          </div>
        </div>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile icon={Calendar} label="Today's Appointments" value="8" accent="yellow" subtitle="2 upcoming" />
        <StatTile icon={FlaskConical} label="Pending Lab Results" value="5" accent="teal" subtitle="2 urgent" />
        <StatTile icon={MessageSquare} label="New Messages" value="12" accent="purple" subtitle="3 unread" />
      </div>

      {/* Navigation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users, label: "Patients", href: "/patients", accent: "yellow" },
          { icon: Lab, label: "Lab Tests", href: "/lab-tests", accent: "teal" },
          { icon: Activity, label: "Diagnostics", href: "/diagnostics", accent: "purple" },
          { icon: Settings, label: "Settings", href: "/settings", accent: "orange" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href}>
              <Card className="group cursor-pointer hover:shadow-neon transition-all hover:-translate-y-0.5 h-full">
                <CardContent className="flex flex-col items-center gap-3 p-5">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-${item.accent === "yellow" ? "primary" : item.accent === "teal" ? "secondary" : item.accent + "-500"}/10`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <span className="font-bold text-sm">{item.label}</span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Today's Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Today's Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { time: "09:00", name: "John Anderson", type: "Follow-up", status: "completed" },
            { time: "10:00", name: "Maria Garcia", type: "New patient", status: "completed" },
            { time: "11:00", name: "Robert Kim", type: "Consultation", status: "in-progress" },
            { time: "14:00", name: "Emily Watson", type: "Test results", status: "upcoming" },
            { time: "15:00", name: "David Lee", type: "Follow-up", status: "upcoming" },
          ].map((apt, i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl bg-muted/50 p-4">
              <div className="flex h-12 w-12 flex-col items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <span className="text-xs font-bold">{apt.time.split(":")[0]}</span>
                <span className="text-[10px]">:{apt.time.split(":")[1]}</span>
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">{apt.name}</p>
                <p className="text-xs text-muted-foreground">{apt.type}</p>
              </div>
              <Badge
                variant={apt.status === "completed" ? "success" : apt.status === "in-progress" ? "neon" : "outline"}
              >
                {apt.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pending Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-secondary" /> Pending Lab Results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { test: "Complete Blood Count", patient: "John A.", status: "ready", urgency: "normal" },
            { test: "Lipid Panel", patient: "Maria G.", status: "in-progress", urgency: "normal" },
            { test: "Troponin Levels", patient: "Robert K.", status: "ready", urgency: "urgent" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl bg-muted/50 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                <FlaskConical className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">{item.test}</p>
                <p className="text-xs text-muted-foreground">Patient: {item.patient}</p>
              </div>
              {item.urgency === "urgent" && <Badge variant="destructive">Urgent</Badge>}
              <Badge variant={item.status === "ready" ? "success" : "warning"}>{item.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
