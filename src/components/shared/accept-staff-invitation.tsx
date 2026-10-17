"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";

/** Accept a facility staff invitation with the signed-in account. */
export function AcceptStaffInvitation({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const accept = async () => {
    setBusy(true); setError("");
    try {
      await apiClient.post("/facility-invitations/redeem", { token });
      router.push("/lab");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept the invitation");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="beeline-card">
      <CardHeader>
        <CardTitle className="text-xl">Facility staff invitation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          You have been invited to join a facility on Medic1905. Accepting links this account to the facility with
          the role assigned in the invitation. The invitation can be used once and matches the email it was sent to.
        </p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" onClick={accept} disabled={busy}>
          {busy ? "Accepting…" : "Accept invitation"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Invitations expire after 7 days. If yours has expired, ask the facility administrator to send a new one.
        </p>
      </CardContent>
    </Card>
  );
}
