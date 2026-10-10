import Link from "next/link";
import { ClipboardList, FlaskConical, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";
import { clinicInstant, clinicToday } from "@/lib/clinic-time";

export default async function LabDashboardPage() {
  const user = await requirePageRole("LAB_SCIENTIST");
  const today = clinicToday();

  const [newOrders, inProgress, submittedToday] = await Promise.all([
    prisma.labOrder.count({ where: { status: "ORDERED" } }),
    prisma.labOrder.count({ where: { status: "IN_PROGRESS" } }),
    prisma.labResult.count({ where: { uploadedById: user.id, createdAt: { gte: clinicInstant(today, 0), lt: clinicInstant(today, 24 * 60) } } }),
  ]);

  const stats = [
    { label: "New orders", value: newOrders, icon: ClipboardList, href: "/lab/orders" },
    { label: "In progress", value: inProgress, icon: FlaskConical, href: "/lab/orders" },
    { label: "Submitted today", value: submittedToday, icon: Upload, href: "/lab/upload" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lab Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Orders and results at a glance</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="beeline-card h-full transition-colors hover:bg-muted/50">
              <CardContent className="p-4">
                <s.icon className="h-5 w-5 text-muted-foreground" />
                <p className="mt-3 text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
