"use client";
import Link from "next/link";
import { Stethoscope, Users, FlaskConical, Activity, Calendar, MessageSquare, FileText, Brain, ArrowRight, HeartPulse } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/shared/stat-tile";

export default function Home() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy-light p-6 md:p-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-10 right-20 h-32 w-32 rounded-full bg-secondary/20 blur-3xl" />
        <div className="relative">
          <Badge variant="neon" className="mb-3">Welcome to Medic1905</Badge>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">
            Your Health, <span className="neon-gradient-text">Simplified</span>
          </h1>
          <p className="mt-2 text-muted-foreground max-w-md">
            AI-powered telemedicine platform for doctors, patients, labs, and diagnostics — all in one place.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/doctors">
              <Button variant="neon" size="lg">
                <Stethoscope className="mr-2 h-5 w-5" /> Find a Doctor
              </Button>
            </Link>
            <Link href="/patients">
              <Button variant="glass" size="lg">
                <Users className="mr-2 h-5 w-5" /> Patient Portal
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={Calendar} label="Appointments Today" value="12" accent="yellow" subtitle="3 pending" />
        <StatTile icon={FlaskConical} label="Lab Results" value="8" accent="teal" subtitle="2 critical" />
        <StatTile icon={Activity} label="Active Cases" value="24" accent="purple" subtitle="5 urgent" />
        <StatTile icon={MessageSquare} label="Messages" value="6" accent="orange" subtitle="2 unread" />
      </div>

      {/* Module Tiles */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Doctor Module */}
        <Link href="/doctors">
          <Card className="group cursor-pointer hover:shadow-neon transition-all duration-300 hover:-translate-y-0.5 h-full">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-navy transition-all">
                  <Stethoscope className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-lg font-bold">Doctor Module</h3>
                  <p className="text-sm text-muted-foreground">Find doctors, book appointments, view profiles</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Patient Module */}
        <Link href="/patients">
          <Card className="group cursor-pointer hover:shadow-neon-teal transition-all duration-300 hover:-translate-y-0.5 h-full">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-secondary/10 text-secondary group-hover:bg-secondary group-hover:text-white transition-all">
                  <Users className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-lg font-bold">Patient Module</h3>
                  <p className="text-sm text-muted-foreground">Dashboard, profiles, medical history timeline</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-secondary transition-colors" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Lab Test Module */}
        <Link href="/lab-tests">
          <Card className="group cursor-pointer hover:shadow-neon transition-all duration-300 hover:-translate-y-0.5 h-full">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-green-500/10 text-green-400 group-hover:bg-green-500 group-hover:text-navy transition-all">
                  <FlaskConical className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-lg font-bold">Lab Tests</h3>
                  <p className="text-sm text-muted-foreground">Catalog, ordering, results with AI interpretation</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-green-400 transition-colors" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Diagnostics Module */}
        <Link href="/diagnostics">
          <Card className="group cursor-pointer hover:shadow-neon-teal transition-all duration-300 hover:-translate-y-0.5 h-full">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all">
                  <Activity className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-lg font-bold">Diagnostics</h3>
                  <p className="text-sm text-muted-foreground">Lab summaries, imaging, clinical notes, AI insights</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-purple-400 transition-colors" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* AI Assistant Banner */}
      <Card className="overflow-hidden border-primary/20">
        <div className="relative bg-gradient-to-r from-primary/10 via-secondary/5 to-transparent p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl neon-gradient animate-glow-pulse">
              <Brain className="h-7 w-7 text-navy" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-bold">AI Medical Assistant</h3>
                <Badge variant="neon">Kimi K3</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Guided questioning, symptom clustering, timeline generation, and structured clinician summaries.
              </p>
            </div>
            <Link href="/patients/medical-history">
              <Button variant="neon">Start</Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Recent Activity */}
      <div>
        <h2 className="font-display text-xl font-bold mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {[
            { icon: Calendar, text: "Appointment scheduled with Dr. Sarah Chen", time: "2h ago", accent: "yellow" },
            { icon: FlaskConical, text: "Blood test results received — Normal", time: "5h ago", accent: "teal" },
            { icon: FileText, text: "New clinical note added to Case #1905", time: "1d ago", accent: "purple" },
            { icon: HeartPulse, text: "Diagnostic case updated — needs attention", time: "2d ago", accent: "orange" },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <Card key={i} className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-${item.accent === "yellow" ? "primary" : item.accent === "teal" ? "secondary" : item.accent + "-500"}/10`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.text}</p>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
