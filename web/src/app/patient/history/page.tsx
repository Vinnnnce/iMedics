import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

export default function PatientHistoryPage() {
  const timeline = [
    { date: "Sep 14, 2026", title: "CBC Lab Results", desc: "Complete blood count test completed", status: "completed" },
    { date: "Sep 12, 2026", title: "Consultation with Dr. Schmidt", desc: "Routine check-up, discussed headache symptoms", status: "completed" },
    { date: "Sep 10, 2026", title: "Lipid Panel Results", desc: "Cholesterol levels within normal range", status: "completed" },
    { date: "Sep 8, 2026", title: "Chest X-Ray", desc: "Clear results, no abnormalities detected", status: "completed" },
    { date: "Sep 5, 2026", title: "Liver Function Test Ordered", desc: "Test ordered by Dr. Schmidt", status: "pending" },
    { date: "Aug 30, 2026", title: "CT Scan — Head", desc: "Normal results", status: "completed" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Case History</h1>
        <p className="text-sm text-muted-foreground mt-1">Timeline of your medical events</p>
      </div>

      <div className="relative space-y-4">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
        {timeline.map((event, i) => (
          <div key={i} className="relative flex gap-4 pl-12">
            <div className={`absolute left-2.5 top-3 h-3 w-3 rounded-full ${
              event.status === "completed" ? "bg-accent-teal" : "bg-primary"
            }`} />
            <Card className="beeline-card flex-1">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{event.title}</p>
                  <span className="text-xs text-muted-foreground">{event.date}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{event.desc}</p>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
