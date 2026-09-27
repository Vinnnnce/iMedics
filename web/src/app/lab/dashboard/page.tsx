import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, ClipboardList, Upload, FlaskConical } from "lucide-react";
import Link from "next/link";

export default function LabDashboardPage() {
  const stats = [
    { label: "Total Users", value: 142, icon: Users },
    { label: "Pending Orders", value: 8, icon: ClipboardList },
    { label: "Results to Upload", value: 5, icon: Upload },
    { label: "Completed Today", value: 12, icon: FlaskConical },
  ];

  const modules = [
    { href: "/lab/orders", label: "Lab Orders", desc: "Manage pending and completed orders", icon: ClipboardList },
    { href: "/lab/users", label: "User Directory", desc: "Browse patients and doctors", icon: Users },
    { href: "/lab/upload", label: "Upload Results", desc: "Upload lab test results", icon: Upload },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Lab Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage lab orders and results</p>
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
                  <h3 className="text-sm font-semibold">{mod.label}</h3>
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

      {/* Pending Orders */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5" /> Pending Lab Orders
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { patient: "John Doe", doctor: "Dr. Schmidt", test: "CBC", date: "Sep 14", status: "Ordered" },
            { patient: "Jane Smith", doctor: "Dr. Johnson", test: "Lipid Panel", date: "Sep 14", status: "In Progress" },
            { patient: "Emily Davis", doctor: "Dr. Lee", test: "Liver Function", date: "Sep 13", status: "Ordered" },
          ].map((order, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">{order.patient} — {order.test}</p>
                <p className="text-xs text-muted-foreground">Ordered by {order.doctor} — {order.date}</p>
              </div>
              <Badge variant="outline" className="rounded-lg">{order.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
