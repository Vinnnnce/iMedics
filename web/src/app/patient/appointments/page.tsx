"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock } from "lucide-react";

export default function PatientAppointmentsPage() {
  const [showBooking, setShowBooking] = useState(false);

  const appointments = [
    { id: 1, doctor: "Dr. Anna Schmidt", date: "Sep 30, 2026", time: "10:00 AM", type: "Video Consultation", status: "Upcoming" },
    { id: 2, doctor: "Dr. Mark Johnson", date: "Sep 15, 2026", time: "2:00 PM", type: "In-Person", status: "Completed" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Appointments</h1>
          <p className="text-sm text-muted-foreground mt-1">Book and manage your consultations</p>
        </div>
        <Button onClick={() => setShowBooking(!showBooking)} className="bg-primary text-primary-foreground rounded-xl">
          <Calendar className="h-4 w-4 mr-1" /> Book New
        </Button>
      </div>

      {showBooking && (
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="text-lg">Book Appointment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Doctor</Label>
                <Select>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select doctor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="schmidt">Dr. Anna Schmidt</SelectItem>
                    <SelectItem value="johnson">Dr. Mark Johnson</SelectItem>
                    <SelectItem value="lee">Dr. Sarah Lee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Consultation Type</Label>
                <Select>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video Consultation</SelectItem>
                    <SelectItem value="inperson">In-Person</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input id="time" type="time" className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Visit</Label>
              <Textarea id="reason" className="rounded-xl" rows={2} />
            </div>
            <div className="flex gap-2">
              <Button className="bg-primary text-primary-foreground rounded-xl">Book Follow-up</Button>
              <Button variant="outline" className="rounded-xl" onClick={() => setShowBooking(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {appointments.map((apt) => (
          <Card key={apt.id} className="beeline-card">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{apt.doctor}</p>
                  <p className="text-xs text-muted-foreground">{apt.date} — {apt.time} — {apt.type}</p>
                </div>
              </div>
              <Button size="sm" variant={apt.status === "Upcoming" ? "default" : "outline"} className="rounded-xl">
                {apt.status === "Upcoming" ? "Join" : "View"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
