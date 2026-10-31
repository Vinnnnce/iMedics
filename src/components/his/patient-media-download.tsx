"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PatientMediaDownload({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="text-right">
      <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
        setBusy(true); setError(null);
        try {
          const res = await fetch(`/api/patient/media/${id}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Download failed");
          window.location.href = data.url;
        } catch (e) { setError(e instanceof Error ? e.message : "Download failed"); } finally { setBusy(false); }
      }}>Download</Button>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
