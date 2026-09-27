import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, Calendar, ClipboardList, FlaskConical, Sparkles,
  Building2, BadgeCheck, Video, MessageSquare, FileText,
  Heart, Stethoscope, ArrowRight,
} from "lucide-react";
import Link from "next/link";

export default function DoctorDashboardPage() {
  const stats = [
    { label: "Booking Requests", value: 5, icon: Calendar },
    { label: "Active Patients", value: 28, icon: Users },
    { label: "Pending Labs", value: 3, icon: FlaskConical },
    { label: "Consultations Today", value: 7, icon: ClipboardList },
  ];

  const aiTools = [
    { href: "/doctor/ai-tools", label: "AI Case Analysis", desc: "AI-powered case history review and insights", icon: Sparkles },
    { href: "/doctor/diagnostics", label: "AI Diagnostics", desc: "AI-assisted diagnostic suggestions", icon: Heart },
    { href: "/doctor/lab-requests", label: "AI Results Analysis", desc: "AI interpretation of lab results", icon: FlaskConical },
  ];

  const modules = [
    { href: "/doctor/patients", label: "Find a Patient", desc: "Search patient records and history", icon: Users },
    { href: "/doctor/booking-requests", label: "Booking Requests", desc: "Review pending appointment requests", icon: Calendar },
    { href: "/doctor/consultations", label: "Write Consultation", desc: "Create consultation notes", icon: ClipboardList },
    { href: "/doctor/chat", label: "Patient Chat", desc: "Message with patients", icon: MessageSquare },
    { href: "/doctor/schedule", label: "Schedule", desc: "Manage your availability", icon: Calendar },
    { href: "/doctor/admit", label: "Admit/Discharge", desc: "Hospital admission management", icon: Building2 },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Doctor Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your patients and consultations</p>
        </div>
        <Badge className="bg-muted text-muted-foreground rounded-lg ml-auto">
          <BadgeCheck className="h-3 w-3 mr-1" /> Verified
        </Badge>
      </div>

      {/* Hero Card */}
      <div className="hero-card p-6">
        <div className="relative z-10">
          <span className="status-badge bg-muted text-muted-foreground mb-3">
            <Sparkles className="h-3 w-3" /> AI-Powered Tools
          </span>
          <h2 className="text-xl font-bold text-foreground mb-2">AI-Driven Clinical Assistance</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            Leverage AI for case history analysis, diagnostic suggestions, and lab result interpretation.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/doctor/ai-tools" className="pill-btn bg-foreground text-background px-5 py-2.5 text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Open AI Tools
            </Link>
            <Link href="/doctor/patients" className="pill-btn bg-secondary text-foreground border border-border px-5 py-2.5 text-sm flex items-center gap-2">
              <Users className="h-4 w-4" /> Find a Patient
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="stat-card p-4">
              <div className="icon-badge h-9 w-9 bg-muted mb-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* AI Tools Section */}
      <div>
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5" /> AI-Driven Tools
        </h3>
        <div className="space-y-3">
          {aiTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link key={tool.href} href={tool.href}>
                <div className="module-card flex items-center gap-4 p-4">
                  <div className="icon-badge h-12 w-12 bg-foreground">
                    <Icon className="h-5 w-5 text-background" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-foreground">{tool.label}</h4>
                    <p className="text-xs text-muted-foreground truncate">{tool.desc}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Module Cards */}
      <div>
        <h3 className="text-lg font-bold mb-3">Quick Actions</h3>
        <div className="space-y-3">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link key={mod.href} href={mod.href}>
                <div className="module-card flex items-center gap-4 p-4">
                  <div className="icon-badge h-10 w-10 bg-muted">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-foreground">{mod.label}</h4>
                    <p className="text-xs text-muted-foreground truncate">{mod.desc}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Requests */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" /> Recent Booking Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">John Doe — Video Consultation</p>
              <p className="text-xs text-muted-foreground">Sep 30, 2026 — 10:00 AM</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="bg-foreground text-background rounded-lg">Accept</Button>
              <Button size="sm" variant="outline" className="rounded-lg">Decline</Button>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Jane Smith — In-Person</p>
              <p className="text-xs text-muted-foreground">Oct 1, 2026 — 9:00 AM</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="bg-foreground text-background rounded-lg">Accept</Button>
              <Button size="sm" variant="outline" className="rounded-lg">Decline</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
