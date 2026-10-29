"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type LabTest = { id: string; code: string; name: string; category: string };
type Facility = { id: string; name: string; type: string };

/** Hospital-side laboratory order creation (Module 01/02, shared workflow). */
export function CreateLabOrderDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseNumber, setCaseNumber] = useState("");
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [tests, setTests] = useState<LabTest[]>([]);
  const [labs, setLabs] = useState<Facility[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [performingFacilityId, setPerformingFacilityId] = useState("");
  const [priority, setPriority] = useState("ROUTINE");
  const [clinicalNotes, setClinicalNotes] = useState("");

  // Load the test catalogue and verified laboratories when the dialog opens.
  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch("/api/lab-tests").then((r) => r.json()),
      fetch("/api/facilities").then((r) => r.json()),
    ])
      .then(([testsData, facilitiesData]) => {
        setTests(testsData.tests ?? []);
        setLabs((facilitiesData.facilities ?? []).filter((f: Facility) => f.type === "LABORATORY"));
      })
      .catch(() => undefined);
  }, [open]);

  const lookup = async () => {
    setError(null);
    setPatientId(""); setPatientName("");
    if (!caseNumber.trim()) return setError("Enter the patient's case number");
    const res = await fetch(`/api/facility/patients?caseNumber=${encodeURIComponent(caseNumber.trim())}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.patient) return setError("No patient found with that case number");
    setPatientId(data.patient.id);
    setPatientName(`${data.patient.firstName} ${data.patient.lastName}`);
  };

  const toggleTest = (code: string, checked: boolean) => {
    setSelectedCodes((prev) => (checked ? [...new Set([...prev, code])] : prev.filter((c) => c !== code)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!patientId) return setError("Look up the patient first");
    if (selectedCodes.length === 0) return setError("Select at least one test");
    if (!performingFacilityId) return setError("Choose the laboratory that will perform the order");
    setBusy(true);
    try {
      const res = await fetch("/api/facility/lab-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          testCodes: selectedCodes,
          performingFacilityId,
          priority,
          clinicalNotes: clinicalNotes.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setOpen(false);
      setCaseNumber(""); setPatientId(""); setPatientName("");
      setSelectedCodes([]); setPerformingFacilityId(""); setClinicalNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">New lab order</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New laboratory order</DialogTitle>
          <DialogDescription>
            Request laboratory investigations for a patient, routed to a specific laboratory.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label>Patient case number</Label>
            <div className="flex gap-2">
              <Input value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} placeholder="e.g. CASE-0001" />
              <Button type="button" variant="secondary" onClick={lookup}>Look up</Button>
            </div>
            {patientName && <p className="text-xs text-muted-foreground">{patientName}</p>}
          </div>
          <div className="space-y-1">
            <Label>Performing laboratory</Label>
            <Select value={performingFacilityId} onValueChange={(v) => setPerformingFacilityId(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Choose a laboratory" /></SelectTrigger>
              <SelectContent>
                {labs.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v ?? "ROUTINE")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ROUTINE">Routine</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
                <SelectItem value="STAT">STAT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Tests</Label>
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border p-2">
              {tests.length === 0 && <p className="text-xs text-muted-foreground">Loading test catalogue…</p>}
              {tests.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={selectedCodes.includes(t.code)}
                    onChange={(e) => toggleTest(t.code, e.target.checked)}
                  />
                  <span>{t.name} <span className="text-xs text-muted-foreground">({t.code})</span></span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Clinical notes (optional)</Label>
            <Textarea rows={2} value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create order
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
