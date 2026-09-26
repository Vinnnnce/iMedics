"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FlaskConical, FileText, Plus, Trash2 } from "lucide-react";

const RESULT_TYPES = [
  "Hematology",
  "Microbiology",
  "Chemical Pathology",
  "Histopathology",
  "Imaging (X-ray)",
  "Imaging (CT Scan)",
  "Imaging (Ultrasound)",
  "Stool Analysis/Culture",
  "Swab Test",
];

export default function LabUploadPage() {
  const [resultType, setResultType] = useState("");
  const [numericValues, setNumericValues] = useState([{ param: "", value: "", unit: "", refRange: "" }]);

  const addValue = () => {
    setNumericValues([...numericValues, { param: "", value: "", unit: "", refRange: "" }]);
  };

  const removeValue = (i: number) => {
    setNumericValues(numericValues.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload Lab Results</h1>
        <p className="text-sm text-muted-foreground mt-1">Enter or upload patient test results</p>
      </div>

      {/* Patient selection */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FlaskConical className="h-5 w-5 text-primary" />
            Result Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Patient</Label>
              <Select>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">John Doe — MED-2026-04821</SelectItem>
                  <SelectItem value="2">Jane Smith — MED-2026-03102</SelectItem>
                  <SelectItem value="3">Emily Davis — MED-2026-05104</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Result Type</Label>
              <Select value={resultType} onValueChange={(v) => setResultType(v || "")}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {RESULT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="testDate">Test Date</Label>
              <Input id="testDate" type="date" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="labName">Lab Name</Label>
              <Input id="labName" placeholder="Laboratory name" className="rounded-xl" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Numeric Values */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-accent-teal" />
            Numeric Values
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {numericValues.map((val, i) => (
            <div key={i} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_1fr_auto] items-end">
              <div className="space-y-1">
                <Label className="text-xs">Parameter</Label>
                <Input placeholder="e.g., Hemoglobin" className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Value</Label>
                <Input placeholder="e.g., 14.5" className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit</Label>
                <Input placeholder="e.g., g/dL" className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ref Range</Label>
                <Input placeholder="e.g., 13.5-17.5" className="rounded-xl" />
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeValue(i)} className="rounded-xl">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={addValue} className="rounded-xl">
            <Plus className="h-4 w-4 mr-1" /> Add Parameter
          </Button>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-5 w-5 text-accent-blue" />
            Upload Result Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/30 transition-colors">
            <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Drop files here or click to upload</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG — Max 10MB</p>
            <Button type="button" variant="outline" size="sm" className="mt-3 rounded-xl">Select Files</Button>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Lab Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea placeholder="Additional notes or comments about the results..." className="rounded-xl" rows={3} />
        </CardContent>
      </Card>

      <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 neon-glow rounded-xl h-12 text-base font-bold">
        Submit Results
      </Button>
    </div>
  );
}
