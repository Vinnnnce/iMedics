"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";

interface Found {
  id: string;
  caseNumber: string;
  name: string;
  gender: string;
  age: number;
}

export function PatientLookup() {
  const [caseNumber, setCaseNumber] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const search = async () => {
    setBusy(true);
    setError("");
    setFound(null);
    try {
      setFound(await apiClient.get<Found>(`/lab/patients?caseNumber=${encodeURIComponent(caseNumber)}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
          placeholder="Case number, e.g. MC-7K3Q9XPD"
          value={caseNumber}
          onChange={(e) => setCaseNumber(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && caseNumber.trim().length >= 6 && search()}
        />
        <Button className="bg-foreground text-background rounded-lg" disabled={busy || caseNumber.trim().length < 6} onClick={search}>
          Look up
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {found && (
        <Card className="beeline-card">
          <CardContent className="space-y-1 p-4 text-sm">
            <p className="font-semibold">{found.name}</p>
            <p className="text-muted-foreground">
              {found.caseNumber} — {found.age} years, {found.gender}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
