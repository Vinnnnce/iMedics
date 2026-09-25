"use client";
import Link from "next/link";
import { Calendar, FlaskConical, Activity, Brain, Plus, Upload, FileText, Heart, User, Phone, MapPin, Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/shared/stat-tile";

export default function PatientDashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy-light p-6 md:p-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-10 right-20 h-32 w-32 rounded-full bg-secondary/20 blur-3xl" />
        <div className="relative">
          <Badge variant="neon" className="mb-2">Patient Portal</Badge>
          <h1 className="font-display text-2xl md:text-3xl font-extrabold">
            Welcome back, <span className="neon-gradient-text">John</span>
          </h1>
          <p className="mt-1 text-muted-foreground">Case #MED-1905-2024 · Last visit: Sep 20, 2024</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/doctors">
              <Button variant="neon" size="sm">
                <Plus className="mr-2 h-4 w-4" /> Book Doctor
              </Button>
            </Link>
            <Button variant="glass" size="sm">
              <Upload className="mr-2 h-4 w-4" /> Upload Results
            </Button>
            <Link href="/diagnostics">
              <Button variant="glass" size="sm">
                <Activity className="mr-2 h-4 w-4" /> View Diagnostics
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={Calendar} label="Upcoming" value="2" accent="yellow" subtitle="Next: Oct 3" />
        <StatTile icon={FlaskConical} label="Lab Tests" value="4" accent="teal" subtitle="2 pending" />
        <StatTile icon={Activity} label="Diagnostics" value="3" accent="purple" subtitle="1 active" />
        <StatTile icon={Heart} label="Health Score" value="85" accent="green" subtitle="Good" />
      </div>

      {/* AI Assistant Tile */}
      <Card className="overflow-hidden border-primary/20">
        <div className="relative bg-gradient-to-r from-primary/10 via-secondary/5 to-transparent p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl neon-gradient animate-glow-pulse">
              <Brain className="h-7 w-7 text-navy" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-bold">AI Health Assistant</h3>
                <Badge variant="neon">Kimi K3</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Complete your medical history with AI-guided questions and get personalized summaries.
              </p>
            </div>
            <Link href="/patients/medical-history">
              <Button variant="neon">Start</Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Quick Actions Grid */}
      <div className="grid md:grid-cols-3 gap-4">
        <Link href="/doctors">
          <Card className="group cursor-pointer hover:shadow-neon transition-all hover:-translate-y-0.5 h-full">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-navy transition-all">
                  <Plus className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold">Book Appointment</p>
                  <p className="text-xs text-muted-foreground">Find and schedule with a doctor</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/lab-tests">
          <Card className="group cursor-pointer hover:shadow-neon-teal transition-all hover:-translate-y-0.5 h-full">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/10 text-secondary group-hover:bg-secondary group-hover:text-white transition-all">
                  <FlaskConical className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold">Order Lab Test</p>
                  <p className="text-xs text-muted-foreground">Browse and order tests online</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/diagnostics">
          <Card className="group cursor-pointer hover:shadow-neon transition-all hover:-translate-y-0.5 h-full">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all">
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold">View Diagnostics</p>
                  <p className="text-xs text-muted-foreground">Check your diagnostic results</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Lab Results + Upcoming Appointments */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Upcoming Appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" /> Upcoming Appointments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { date: "Oct 3, 10:00", doctor: "Dr. Sarah Chen", type: "Cardiology follow-up" },
              { date: "Oct 10, 14:00", doctor: "Dr. James Park", type: "Dermatology consultation" },
            ].map((apt, i) => (
              <div key={i} className="rounded-2xl bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm">{apt.doctor}</p>
                    <p className="text-xs text-muted-foreground">{apt.type}</p>
                  </div>
                  <Badge variant="neon">{apt.date}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Lab Tests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-secondary" /> Recent Lab Tests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: "Complete Blood Count", date: "Sep 20", status: "ready", statusVariant: "success" },
              { name: "Lipid Panel", date: "Sep 18", status: "in-progress", statusVariant: "warning" },
            ].map((test, i) => (
              <Link key={i} href="/lab-tests/results">
                <div className="rounded-2xl bg-muted/50 p-4 hover:bg-muted transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">{test.name}</p>
                      <p className="text-xs text-muted-foreground">{test.date}</p>
                    </div>
                    <Badge variant={test.statusVariant as any}>{test.status}</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
