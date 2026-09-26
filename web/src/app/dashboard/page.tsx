import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FlaskConical, Heart, FileText, ClipboardList, Pill, Calendar, Video, Star } from "lucide-react";

export default async function DashboardPage() {
  const clerkUser = await currentUser();
  const role = ((clerkUser?.publicMetadata as Record<string, unknown>)?.role as string) ||
    ((clerkUser?.unsafeMetadata as Record<string, unknown>)?.role as string) || "PATIENT";

  // Redirect doctors and lab staff to their dashboards
  if (role === "DOCTOR") redirect("/doctor/dashboard");
  if (role === "LAB_SCIENTIST") redirect("/lab/dashboard");

  const quickActions = [
    { href: "/patient/results", label: "Analysis Results", icon: FlaskConical, color: "text-accent-teal", bg: "bg-accent-teal/10" },
    { href: "/patient/diagnostics", label: "Diagnostics", icon: Heart, color: "text-accent-red", bg: "bg-accent-red/10" },
    { href: "/patient/case-file", label: "Case File", icon: FileText, color: "text-primary", bg: "bg-primary/10" },
    { href: "/patient/history", label: "Case History", icon: ClipboardList, color: "text-accent-blue", bg: "bg-accent-blue/10" },
    { href: "/patient/prescriptions", label: "Prescriptions", icon: Pill, color: "text-accent-teal", bg: "bg-accent-teal/10" },
    { href: "/doctors", label: "Find Doctors", icon: Star, color: "text-primary", bg: "bg-primary/10" },
    { href: "/patient/appointments", label: "Book Appointment", icon: Calendar, color: "text-accent-blue", bg: "bg-accent-blue/10" },
    { href: "/patient/consult", label: "Consultation", icon: Video, color: "text-accent-teal", bg: "bg-accent-teal/10" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Patient Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your health, appointments, and results</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href}>
              <Card className="beeline-tile beeline-card cursor-pointer h-full">
                <CardContent className="flex flex-col items-center justify-center p-4 text-center">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${action.bg} mb-2`}>
                    <Icon className={`h-6 w-6 ${action.color}`} />
                  </div>
                  <p className="text-xs md:text-sm font-medium">{action.label}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FlaskConical className="h-5 w-5 text-primary" />
            Recent Lab Results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <p className="text-sm font-medium">Complete Blood Count (CBC)</p>
              <p className="text-xs text-muted-foreground">Sep 14, 2026 — Verified</p>
            </div>
            <Button size="sm" variant="outline" className="rounded-xl">View</Button>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <p className="text-sm font-medium">Lipid Panel</p>
              <p className="text-xs text-muted-foreground">Sep 10, 2026 — Verified</p>
            </div>
            <Button size="sm" variant="outline" className="rounded-xl">View</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
