import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, ClipboardList, FlaskConical, Sparkles, Building2, BadgeCheck, Video, MessageSquare } from "lucide-react";

export default function DoctorDashboardPage() {
  const stats = [
    { label: "Booking Requests", value: 5, icon: Calendar, color: "text-foreground", bg: "bg-foreground/10" },
    { label: "Active Patients", value: 28, icon: Users, color: "text-muted-foreground", bg: "bg-muted" },
    { label: "Pending Lab Results", value: 3, icon: FlaskConical, color: "text-muted-foreground", bg: "bg-muted" },
    { label: "Consultations Today", value: 7, icon: ClipboardList, color: "text-destructive", bg: "bg-muted" },
  ];

  const quickActions = [
    { href: "/doctor/booking-requests", label: "Booking Requests", icon: Calendar, color: "text-foreground", bg: "bg-foreground/10" },
    { href: "/doctor/patients", label: "My Patients", icon: Users, color: "text-muted-foreground", bg: "bg-muted" },
    { href: "/doctor/consultations", label: "Write Consultation", icon: ClipboardList, color: "text-muted-foreground", bg: "bg-muted" },
    { href: "/doctor/chat", label: "Patient Chat", icon: MessageSquare, color: "text-muted-foreground", bg: "bg-muted" },
    { href: "/doctor/lab-requests", label: "Request Labs", icon: FlaskConical, color: "text-foreground", bg: "bg-foreground/10" },
    { href: "/doctor/ai-tools", label: "AI Tools", icon: Sparkles, color: "text-muted-foreground", bg: "bg-muted" },
    { href: "/doctor/admit", label: "Admit/Discharge", icon: Building2, color: "text-muted-foreground", bg: "bg-muted" },
    { href: "/doctor/schedule", label: "Schedule", icon: Calendar, color: "text-foreground", bg: "bg-foreground/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Doctor Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your patients and consultations</p>
        </div>
        <Badge className="bg-muted text-muted-foreground rounded-lg ml-auto">
          <BadgeCheck className="h-3 w-3 mr-1" /> Verified
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="beeline-card">
              <CardContent className="p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg} mb-2`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <a key={action.href} href={action.href}>
              <Card className="beeline-tile beeline-card cursor-pointer h-full">
                <CardContent className="flex flex-col items-center justify-center p-4 text-center">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${action.bg} mb-2`}>
                    <Icon className={`h-6 w-6 ${action.color}`} />
                  </div>
                  <p className="text-xs md:text-sm font-medium">{action.label}</p>
                </CardContent>
              </Card>
            </a>
          );
        })}
      </div>

      {/* Recent Booking Requests */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-foreground" />
            Recent Booking Requests
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
