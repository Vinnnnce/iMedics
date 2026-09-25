"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const TIME_SLOTS = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];

export default function AppointmentsPage() {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("Dr. Anna Schmidt");
  const [confirmed, setConfirmed] = useState(false);

  const handleBook = () => {
    if (selectedDate && selectedTime) setConfirmed(true);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Book an Appointment</h1>
        <p className="text-sm text-muted-foreground mt-1">Choose a doctor, date, and time</p>
      </div>

      {!confirmed ? (
        <>
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">Doctor</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {["Dr. Anna Schmidt (GP)", "Dr. Marcus Weber (Cardiologist)", "Dr. Elena Fischer (Dermatologist)"].map((doc) => (
                  <button
                    key={doc}
                    onClick={() => setSelectedDoctor(doc)}
                    className={`w-full text-left rounded-lg p-3 border-2 transition-colors ${selectedDoctor === doc ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                  >
                    <span className="text-sm font-medium">{doc}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">Date</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="date">Select Date</Label>
                <Input id="date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">Time Slot</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {TIME_SLOTS.map((time) => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={`rounded-lg p-2 text-sm font-medium border-2 transition-colors ${selectedTime === time ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/30"}`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleBook} disabled={!selectedDate || !selectedTime} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 neon-glow" size="lg">
            Confirm Booking
          </Button>
        </>
      ) : (
        <Card className="bg-card border-primary/30 neon-glow">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <CardTitle className="text-lg text-primary">Appointment Confirmed</CardTitle>
            <CardDescription className="text-sm">
              {selectedDoctor} on {selectedDate} at {selectedTime}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-lg border border-border p-3 space-y-1">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Doctor</span><span className="font-medium">{selectedDoctor}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Date</span><span className="font-medium">{selectedDate}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Time</span><span className="font-medium">{selectedTime}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Type</span><Badge variant="outline" className="border-primary/30 text-primary">Video Call</Badge></div>
            </div>
            <Button onClick={() => setConfirmed(false)} variant="outline" className="w-full">Book Another</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
