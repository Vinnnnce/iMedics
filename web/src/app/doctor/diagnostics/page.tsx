"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, X, Scan } from "lucide-react";

export default function DoctorDiagnosticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Diagnostics</h1>
        <p className="text-sm text-muted-foreground mt-1">Request diagnostic tests for patients</p>
      </div>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Scan className="h-5 w-5 text-primary" />
            Request Diagnostic
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Patient</Label>
              <Select>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">John Doe</SelectItem>
                  <SelectItem value="2">Jane Smith</SelectItem>
                  <SelectItem value="3">Emily Davis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Diagnostic Type</Label>
              <Select>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ecg">ECG (Electrocardiogram)</SelectItem>
                  <SelectItem value="xray">X-Ray</SelectItem>
                  <SelectItem value="ct">CT Scan</SelectItem>
                  <SelectItem value="mri">MRI</SelectItem>
                  <SelectItem value="ultrasound">Ultrasound</SelectItem>
                  <SelectItem value="ekg">EKG</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Body Region</Label>
              <Input id="region" placeholder="e.g., Chest, Head, Abdomen" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="bg-primary text-primary-foreground rounded-xl">Submit Request</Button>
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Recent Diagnostics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { patient: "John Doe", type: "ECG", date: "Sep 12", status: "Completed" },
            { patient: "Jane Smith", type: "Chest X-Ray", date: "Sep 8", status: "Completed" },
            { patient: "Emily Davis", type: "Ultrasound — Abdomen", date: "Sep 5", status: "Pending" },
          ].map((req, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-border p-3">
              <div className="flex items-center gap-3">
                <Heart className="h-4 w-4 text-accent-red" />
                <div>
                  <p className="text-sm font-medium">{req.patient} — {req.type}</p>
                  <p className="text-xs text-muted-foreground">{req.date}</p>
                </div>
              </div>
              <span className={`text-xs font-medium rounded-lg px-2 py-1 ${
                req.status === "Completed" ? "bg-accent-teal/10 text-accent-teal" : "bg-primary/10 text-primary"
              }`}>{req.status}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
