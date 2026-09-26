import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, ClipboardList, Upload, FlaskConical } from "lucide-react";

export default function LabDashboardPage() {
  const stats = [
    { label: "Total Users", value: 142, icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "Pending Orders", value: 8, icon: ClipboardList, color: "text-accent-teal", bg: "bg-accent-teal/10" },
    { label: "Results to Upload", value: 5, icon: Upload, color: "text-accent-blue", bg: "bg-accent-blue/10" },
    { label: "Completed Today", value: 12, icon: FlaskConical, color: "text-accent-red", bg: "bg-accent-red/10" },
  ];

  const quickActions = [
    { href: "/lab/orders", label: "Lab Orders", icon: ClipboardList, color: "text-primary", bg: "bg-primary/10" },
    { href: "/lab/users", label: "User Directory", icon: Users, color: "text-accent-teal", bg: "bg-accent-teal/10" },
    { href: "/lab/upload", label: "Upload Results", icon: Upload, color: "text-accent-blue", bg: "bg-accent-blue/10" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lab Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage lab orders and results</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="beeline-card">
              <CardContent className="p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg} mb-2`}>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <a key={action.href} href={action.href}>
              <Card className="beeline-tile beeline-card cursor-pointer h-full">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${action.bg}`}>
                    <Icon className={`h-6 w-6 ${action.color}`} />
                  </div>
                  <p className="text-sm font-medium">{action.label}</p>
                </CardContent>
              </Card>
            </a>
          );
        })}
      </div>

      {/* Pending Orders */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-primary" />
            Pending Lab Orders
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { patient: "John Doe", doctor: "Dr. Schmidt", test: "CBC", date: "Sep 14", status: "Ordered" },
            { patient: "Jane Smith", doctor: "Dr. Johnson", test: "Lipid Panel", date: "Sep 14", status: "In Progress" },
            { patient: "Emily Davis", doctor: "Dr. Lee", test: "Liver Function", date: "Sep 13", status: "Ordered" },
          ].map((order, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-border p-3">
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
