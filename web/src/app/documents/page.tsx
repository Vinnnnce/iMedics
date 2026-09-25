"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, Plus, Trash2 } from "lucide-react";

const CATEGORIES = [
  { value: "CBC", label: "Complete Blood Count" },
  { value: "CMP", label: "Comprehensive Metabolic Panel" },
  { value: "LIPID", label: "Lipid Panel" },
  { value: "THYROID", label: "Thyroid Function" },
  { value: "HBA1C", label: "HbA1c (Diabetes)" },
  { value: "IRON", label: "Iron Studies" },
  { value: "LIVER", label: "Liver Function Tests" },
  { value: "RENAL", label: "Renal Function Panel" },
  { value: "IMAGING", label: "Imaging (X-ray, CT, Ultrasound)" },
  { value: "MICROBIOLOGY", label: "Microbiology" },
  { value: "HISTOPATHOLOGY", label: "Histopathology" },
  { value: "STOOL", label: "Stool Analysis / Culture" },
  { value: "SWAB", label: "Swab Test" },
];

interface LabValue {
  code: string;
  name: string;
  value: string;
  unit: string;
  refLow: string;
  refHigh: string;
}

export default function DocumentsPage() {
  const [category, setCategory] = useState<string | null>("CBC");
  const [labName, setLabName] = useState("");
  const [testDate, setTestDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualEntry, setManualEntry] = useState(false);
  const [values, setValues] = useState<LabValue[]>([
    { code: "", name: "", value: "", unit: "", refLow: "", refHigh: "" },
  ]);

  const addValue = () => setValues([...values, { code: "", name: "", value: "", unit: "", refLow: "", refHigh: "" }]);
  const removeValue = (i: number) => setValues(values.filter((_, idx) => idx !== i));
  const updateValue = (i: number, field: keyof LabValue, val: string) => {
    const updated = [...values];
    updated[i] = { ...updated[i], [field]: val };
    setValues(updated);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Lab Results</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload a file or enter values manually for AI analysis</p>
      </div>

      {/* Category */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Test Category</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Lab info */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Lab Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="labName">Lab Name</Label>
            <Input id="labName" value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="e.g., CityLab Frankfurt" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="testDate">Test Date</Label>
            <Input id="testDate" type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* File upload */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Upload File</CardTitle>
          <CardDescription className="text-xs">PDF, JPG, PNG — max 10MB</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50">
            <Upload className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">Click to select a file</p>
            <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
            <Input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
          </div>
        </CardContent>
      </Card>

      {/* Manual entry */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Manual Value Entry</CardTitle>
              <CardDescription className="text-xs">Enter lab values for structured AI analysis</CardDescription>
            </div>
            <Button variant={manualEntry ? "default" : "outline"} size="sm" onClick={() => setManualEntry(!manualEntry)}>
              {manualEntry ? "Hide" : "Show"}
            </Button>
          </div>
        </CardHeader>
        {manualEntry && (
          <CardContent className="space-y-4">
            {values.map((field, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Value #{i + 1}</span>
                  {values.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeValue(i)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Code</Label>
                    <Input value={field.code} onChange={(e) => updateValue(i, "code", e.target.value)} placeholder="HGB" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Test Name</Label>
                    <Input value={field.name} onChange={(e) => updateValue(i, "name", e.target.value)} placeholder="Hemoglobin" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Value</Label>
                    <Input value={field.value} onChange={(e) => updateValue(i, "value", e.target.value)} placeholder="14.5" type="number" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unit</Label>
                    <Input value={field.unit} onChange={(e) => updateValue(i, "unit", e.target.value)} placeholder="g/dL" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ref Low</Label>
                    <Input value={field.refLow} onChange={(e) => updateValue(i, "refLow", e.target.value)} placeholder="12" type="number" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ref High</Label>
                    <Input value={field.refHigh} onChange={(e) => updateValue(i, "refHigh", e.target.value)} placeholder="16" type="number" />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addValue} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Add Another Value
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Submit */}
      <div className="space-y-2">
        <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 neon-glow" size="lg">
          Submit for AI Analysis
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          AI explanations are informational only, not a medical diagnosis. Always consult your doctor.
        </p>
      </div>
    </div>
  );
}
