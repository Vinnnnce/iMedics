"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";

const field = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm";

export function NoteForm({ patients }: { patients: { id: string; name: string; caseNumber: string }[] }) {
  const router = useRouter();
  const [patientId, setPatientId] = useState("");
  const [type, setType] = useState<"PROGRESS" | "ASSESSMENT" | "PLAN">("PROGRESS");
  const [content, setContent] = useState("");
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setMessage(null);
      try {
        await apiClient.post("/clinical-notes", { patientId, type, content, visibleToPatient: visible });
        setContent("");
        setMessage({ type: "ok", text: "Note saved." });
        router.refresh();
      } catch (e) {
        setMessage({ type: "error", text: e instanceof Error ? e.message : "Could not save the note" });
      }
    });

  return (
    <Card className="beeline-card">
      <CardHeader>
        <CardTitle className="text-lg">New note</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <select className={field} value={patientId} onChange={(e) => setPatientId(e.target.value)} aria-label="Patient">
            <option value="">Select a patient…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.caseNumber}
              </option>
            ))}
          </select>
          <select className={field} value={type} onChange={(e) => setType(e.target.value as typeof type)} aria-label="Note type">
            <option value="PROGRESS">Progress note</option>
            <option value="ASSESSMENT">Assessment</option>
            <option value="PLAN">Plan</option>
          </select>
        </div>
        <textarea className="min-h-28 w-full rounded-lg border border-input bg-background p-2 text-sm" maxLength={5000} placeholder="Write your note…" value={content} onChange={(e) => setContent(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
          Share this note with the patient
        </label>
        <div className="flex items-center gap-3">
          <Button className="bg-foreground text-background rounded-lg" disabled={pending || !patientId || !content.trim()} onClick={submit}>
            {pending ? "Saving…" : "Save note"}
          </Button>
          {message && <p className={`text-sm ${message.type === "ok" ? "text-muted-foreground" : "text-destructive"}`}>{message.text}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
