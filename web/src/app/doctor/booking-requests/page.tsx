import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Check, X } from "lucide-react";

export default function DoctorBookingRequestsPage() {
  const requests = [
    { id: 1, patient: "John Doe", type: "Video Consultation", date: "Sep 30, 2026", time: "10:00 AM", reason: "Follow-up on headaches", status: "pending" },
    { id: 2, patient: "Jane Smith", type: "In-Person", date: "Oct 1, 2026", time: "9:00 AM", reason: "Annual check-up", status: "pending" },
    { id: 3, patient: "Robert Brown", type: "Video Consultation", date: "Oct 2, 2026", time: "3:00 PM", reason: "Medication review", status: "pending" },
    { id: 4, patient: "Emily Davis", type: "In-Person", date: "Oct 3, 2026", time: "11:00 AM", reason: "Skin rash consultation", status: "pending" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Booking Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage incoming appointment requests</p>
      </div>

      <div className="space-y-3">
        {requests.map((req) => (
          <Card key={req.id} className="beeline-card">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Calendar className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{req.patient}</p>
                      <Badge variant="outline" className="rounded-lg text-xs">{req.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{req.date} — {req.time}</p>
                    <p className="text-xs text-muted-foreground mt-1">Reason: {req.reason}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-accent-teal text-white rounded-xl">
                    <Check className="h-4 w-4 mr-1" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl">
                    <X className="h-4 w-4 mr-1" /> Decline
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
