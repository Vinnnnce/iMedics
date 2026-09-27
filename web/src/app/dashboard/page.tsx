import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { Stethoscope, Calendar, FileText, Heart, Video, FlaskConical } from "lucide-react";

export default async function DashboardPage() {
  const clerkUser = await currentUser();
  const role = ((clerkUser?.publicMetadata as Record<string, unknown>)?.role as string) ||
    ((clerkUser?.unsafeMetadata as Record<string, unknown>)?.role as string) || "PATIENT";

  if (role === "DOCTOR") redirect("/doctor/dashboard");
  if (role === "LAB_SCIENTIST") redirect("/lab/dashboard");

  // Check if registration is pending
  const registrationStatus = (clerkUser?.unsafeMetadata as Record<string, unknown>)?.registrationStatus as string;
  const registrationComplete = (clerkUser?.unsafeMetadata as Record<string, unknown>)?.registrationComplete as boolean;
  if (registrationComplete && registrationStatus === "pending") {
    redirect("/auth/callback");
  }

  const stats = [
    { label: "Appointments", value: "3", sub: "1 upcoming", icon: Calendar },
    { label: "Lab Results", value: "5", sub: "2 new", icon: FlaskConical },
    { label: "Active Cases", value: "2", sub: "1 ongoing", icon: FileText },
    { label: "Messages", value: "4", sub: "1 unread", icon: Video },
  ];

  const modules = [
    { href: "/doctors", label: "Find a Doctor", desc: "Search and book appointments with specialists", icon: Stethoscope },
    { href: "/patient/appointments", label: "My Appointments", desc: "View upcoming and past appointments", icon: Calendar },
    { href: "/patient/results", label: "Lab Results", desc: "View your test results and reports", icon: FlaskConical },
    { href: "/patient/case-file", label: "Case File", desc: "Your medical history and documents", icon: FileText },
    { href: "/patient/consult", label: "Consultation", desc: "Start a video consultation", icon: Video },
    { href: "/patient/history", label: "Case History", desc: "Timeline of your medical visits", icon: Heart },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Hero Card */}
      <div className="hero-card p-6 md:p-8">
        <div className="relative z-10">
          <span className="status-badge bg-muted text-muted-foreground mb-3">
            Welcome to Medic1905
          </span>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Your Health, Simplified
          </h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Telemedicine platform for doctors, patients, labs, and diagnostics — all in one place.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/doctors"
              className="pill-btn bg-foreground text-background px-5 py-2.5 text-sm flex items-center gap-2"
            >
              <Stethoscope className="h-4 w-4" />
              Find a Doctor
            </Link>
            <Link
              href="/patient/consult"
              className="pill-btn bg-secondary text-foreground border border-border px-5 py-2.5 text-sm flex items-center gap-2"
            >
              <Video className="h-4 w-4" />
              Start Consultation
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="stat-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="icon-badge h-9 w-9 bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Module Cards */}
      <div className="space-y-3">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link key={mod.href} href={mod.href}>
              <div className="module-card flex items-center gap-4 p-4">
                <div className="icon-badge h-12 w-12 bg-muted">
                  <Icon className="h-5 w-5 text-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{mod.label}</h3>
                  <p className="text-xs text-muted-foreground truncate">{mod.desc}</p>
                </div>
                <svg className="h-5 w-5 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
