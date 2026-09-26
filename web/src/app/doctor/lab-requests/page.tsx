"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlaskConical, Plus } from "lucide-react";

export default function DoctorLabRequestsPage() {
  const [tests, setTests] = useState<string[]>([]);
  const [testInput, setTestInput] = useState("");

  const addTest = () => {
    if (testInput.trim() && !tests.includes(testInput)) {
      setTests([...tests, testInput]);
      setTestInput("");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lab Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">Order lab tests and diagnostics for patients</p>
      </div>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FlaskConical className="h-5 w-5 text-primary" />
            Request Lab Test
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
              <Label>Panel Type</Label>
              <Select>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select panel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cbc">Complete Blood Count (CBC)</SelectItem>
                  <SelectItem value="lipid">Lipid Panel</SelectItem>
                  <SelectItem value="liver">Liver Function Test</SelectItem>
                  <SelectItem value="thyroid">Thyroid Panel</SelectItem>
                  <SelectItem value="urinalysis">Urinalysis</SelectItem>
                  <SelectItem value="xray">X-Ray</SelectItem>
                  <SelectItem value="ct">CT Scan</SelectItem>
                  <SelectItem value="ultrasound">Ultrasound</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Specific Tests</Label>
            <div className="flex gap-2">
              <Input
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTest(); } }}
                placeholder="Add specific test..."
                className="rounded-xl"
              />
              <Button type="button" onClick={addTest} variant="outline" className="rounded-xl">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tests.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tests.map((t) => (
                  <span key={t} className="rounded-lg bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
                    {t}
                    <button onClick={() => setTests(tests.filter((x) => x !== t))} className="ml-2">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Clinical Notes</Label>
            <Textarea id="notes" placeholder="Reason for test, clinical context..." className="rounded-xl" rows={3} />
          </div>

          <Button className="bg-primary text-primary-foreground rounded-xl">Submit Lab Request</Button>
        </CardContent>
      </Card>

      {/* Recent Requests */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Recent Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { patient: "John Doe", test: "CBC + Lipid Panel", date: "Sep 14", status: "Completed" },
            { patient: "Jane Smith", test: "Liver Function Test", date: "Sep 10", status: "In Progress" },
            { patient: "Emily Davis", test: "Thyroid Panel", date: "Sep 5", status: "Ordered" },
          ].map((req, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium">{req.patient} — {req.test}</p>
                <p className="text-xs text-muted-foreground">{req.date}</p>
              </div>
              <span className={`text-xs font-medium rounded-lg px-2 py-1 ${
                req.status === "Completed" ? "bg-accent-teal/10 text-accent-teal" :
                req.status === "In Progress" ? "bg-primary/10 text-primary" :
                "bg-muted text-muted-foreground"
              }`}>{req.status}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
