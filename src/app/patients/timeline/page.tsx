"use client";
import { useState } from "react";
import { Calendar, FlaskConical, Image, FileText, Stethoscope, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const filters = ["All", "Consultations", "Lab Tests", "Imaging"];

const timeline = [
  { date: "2024-09-25", type: "consultation", title: "Cardiology Follow-up", doctor: "Dr. Sarah Chen", summary: "Routine follow-up. Blood pressure stable. Medication adjusted.", icon: Stethoscope },
  { date: "2024-09-20", type: "lab_test", title: "Complete Blood Count", doctor: "Lab: Central Lab", summary: "All values within normal range. No abnormalities detected.", icon: FlaskConical },
  { date: "2024-09-15", type: "imaging", title: "Chest X-Ray", doctor: "Dr. James Park", summary: "No acute findings. Heart size normal. Lungs clear.", icon: Image },
  { date: "2024-09-10", type: "consultation", title: "Initial Consultation", doctor: "Dr. Sarah Chen", summary: "New patient evaluation. Comprehensive history taken. Ordered initial labs.", icon: Stethoscope },
  { date: "2024-09-05", type: "lab_test", title: "Lipid Panel", doctor: "Lab: Central Lab", summary: "Cholesterol slightly elevated. HDL normal. LDL marginally high.", icon: FlaskConical },
  { date: "2024-08-28", type: "consultation", title: "General Checkup", doctor: "Dr. Emily Watson", summary: "Annual physical examination. Overall health is good.", icon: FileText },
];

export default function PatientTimeline() {
  const [activeFilter, setActiveFilter] = useState("All");

  const filtered = timeline.filter((entry) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Consultations") return entry.type === "consultation";
    if (activeFilter === "Lab Tests") return entry.type === "lab_test";
    if (activeFilter === "Imaging") return entry.type === "imaging";
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-extrabold">Medical History Timeline</h1>
        <p className="text-muted-foreground mt-1">Your complete medical journey</p>
      </div>

      {/* Filters */}
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-2">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "rounded-2xl px-4 py-2 text-sm font-bold transition-all whitespace-nowrap",
                activeFilter === filter
                  ? "bg-primary text-navy neon-glow-yellow"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              {filter}
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-secondary to-transparent" />

        <div className="space-y-6">
          {filtered.map((entry, i) => {
            const Icon = entry.icon;
            return (
              <div key={i} className="relative pl-14">
                {/* Timeline Dot */}
                <div className={cn(
                  "absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-full border-4 border-background",
                  entry.type === "consultation" ? "bg-primary/15 text-primary" :
                  entry.type === "lab_test" ? "bg-secondary/15 text-secondary" :
                  "bg-purple-500/15 text-purple-400"
                )}>
                  <div className={cn(
                    "absolute inset-0 rounded-full blur-sm opacity-50",
                    entry.type === "consultation" ? "bg-primary" :
                    entry.type === "lab_test" ? "bg-secondary" : "bg-purple-500"
                  )} />
                  <Icon className="h-5 w-5 relative" />
                </div>

                {/* Card */}
                <Card className="hover:shadow-card transition-all cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold">{entry.title}</h3>
                      <Badge variant="outline" className="text-xs">
                        <Calendar className="mr-1 h-3 w-3" />
                        {entry.date}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{entry.summary}</p>
                    <p className="text-xs font-bold text-primary">{entry.doctor}</p>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
