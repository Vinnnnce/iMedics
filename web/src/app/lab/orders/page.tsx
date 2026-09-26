import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";

export default function LabOrdersPage() {
  const orders = [
    { id: 1, patient: "John Doe", doctor: "Dr. Schmidt", test: "Complete Blood Count", date: "Sep 14, 2026", status: "Ordered" },
    { id: 2, patient: "Jane Smith", doctor: "Dr. Johnson", test: "Lipid Panel", date: "Sep 14, 2026", status: "In Progress" },
    { id: 3, patient: "Emily Davis", doctor: "Dr. Lee", test: "Liver Function Test", date: "Sep 13, 2026", status: "Ordered" },
    { id: 4, patient: "Robert Brown", doctor: "Dr. Wilson", test: "Thyroid Panel", date: "Sep 12, 2026", status: "Completed" },
    { id: 5, patient: "John Doe", doctor: "Dr. Schmidt", test: "Urinalysis", date: "Sep 11, 2026", status: "Completed" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lab Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">View and manage all lab test requests</p>
      </div>

      <div className="space-y-3">
        {orders.map((order) => (
          <Card key={order.id} className="beeline-card">
            <CardContent className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{order.patient} — {order.test}</p>
                  <p className="text-xs text-muted-foreground">Ordered by {order.doctor} — {order.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={order.status === "Completed" ? "secondary" : "outline"} className={
                  order.status === "Completed" ? "bg-accent-teal/10 text-accent-teal rounded-lg" :
                  order.status === "In Progress" ? "bg-primary/10 text-primary rounded-lg" : "rounded-lg"
                }>
                  {order.status}
                </Badge>
                {order.status !== "Completed" && (
                  <Button size="sm" className="bg-primary text-primary-foreground rounded-xl">Update</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
