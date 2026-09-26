"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Plus } from "lucide-react";

export default function DoctorSchedulePage() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const slots = [
    { day: "Mon", time: "09:00 - 12:00", booked: 3 },
    { day: "Tue", time: "10:00 - 14:00", booked: 5 },
    { day: "Wed", time: "09:00 - 12:00", booked: 2 },
    { day: "Thu", time: "14:00 - 17:00", booked: 4 },
    { day: "Fri", time: "09:00 - 15:00", booked: 6 },
    { day: "Sat", time: "Off", booked: 0 },
    { day: "Sun", time: "Off", booked: 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schedule Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Publish your consultation availability</p>
        </div>
        <Button className="bg-primary text-primary-foreground rounded-xl">
          <Plus className="h-4 w-4 mr-1" /> Add Slot
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {slots.map((slot) => (
          <Card key={slot.day} className="beeline-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{slot.day}</p>
                    <p className="text-xs text-muted-foreground">{slot.time}</p>
                  </div>
                </div>
                <Badge variant={slot.booked > 0 ? "secondary" : "outline"} className="rounded-lg">
                  {slot.booked} booked
                </Badge>
              </div>
              <Button size="sm" variant="outline" className="w-full rounded-xl">Edit</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
