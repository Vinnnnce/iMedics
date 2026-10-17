"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";

type Action =
  | { kind: "status"; status: "SUSPENDED" | "BANNED" | "ACTIVE" }
  | { kind: "admin"; grant: boolean };

interface Props {
  userId: string;
  name: string;
  status: string;
  role: string;
  statusReason: string | null;
  isSelf: boolean;
}

const COPY = {
  SUSPENDED: { title: "Suspend account", body: "The user is signed out of everything and cannot sign in until you restore them. They are told it was restricted and can see your reason.", confirm: "Suspend" },
  BANNED: { title: "Ban account", body: "Use for serious or repeated violations. The user cannot sign in. You can still restore the account later.", confirm: "Ban" },
  ACTIVE: { title: "Restore account", body: "The user can sign in again and is told their access was restored.", confirm: "Restore" },
} as const;

/** Suspend, ban or restore an account (with a reason), and grant or remove administrator access. */
export function AccountControls({ userId, name, status, role, statusReason, isSelf }: Props) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    setAction(null);
    setReason("");
    setError("");
  };

  const run = async () => {
    if (!action) return;
    setBusy(true);
    setError("");
    try {
      await apiClient.patch(`/admin/users/${userId}`, action.kind === "status" ? { status: action.status, reason: reason || undefined } : { administrator: action.grant });
      close();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const needsReason = action?.kind === "status" && action.status !== "ACTIVE";

  return (
    <Card className="beeline-card">
      <CardHeader><CardTitle className="text-base">Controls</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {isSelf && <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">This is your own account. Another administrator must change it.</p>}

        {status === "PENDING" && <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">This account is waiting for verification. Decide it under Verifications.</p>}

        {(status === "SUSPENDED" || status === "BANNED") && (
          <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="font-medium">{status === "BANNED" ? "Banned" : "Suspended"}</p>
            {statusReason && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{statusReason}</p>}
          </div>
        )}

        {!isSelf && status === "ACTIVE" && (
          <div className="grid gap-2">
            <Button variant="outline" className="justify-start rounded-lg" onClick={() => setAction({ kind: "status", status: "SUSPENDED" })}><UserX className="mr-2 h-4 w-4" /> Suspend</Button>
            <Button variant="outline" className="justify-start rounded-lg text-destructive" onClick={() => setAction({ kind: "status", status: "BANNED" })}><ShieldAlert className="mr-2 h-4 w-4" /> Ban</Button>
          </div>
        )}
        {!isSelf && (status === "SUSPENDED" || status === "BANNED") && (
          <Button className="w-full rounded-lg bg-foreground text-background" onClick={() => setAction({ kind: "status", status: "ACTIVE" })}><UserCheck className="mr-2 h-4 w-4" /> Restore access</Button>
        )}

        {!isSelf && status === "ACTIVE" && (
          <div className="border-t border-border pt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Administrator access</p>
            {role === "ADMIN" ? (
              <Button variant="outline" className="w-full justify-start rounded-lg" onClick={() => setAction({ kind: "admin", grant: false })}><ShieldCheck className="mr-2 h-4 w-4" /> Remove administrator access</Button>
            ) : (
              <Button variant="outline" className="w-full justify-start rounded-lg" onClick={() => setAction({ kind: "admin", grant: true })}><ShieldCheck className="mr-2 h-4 w-4" /> Make administrator</Button>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={action !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action?.kind === "status" ? COPY[action.status].title : action?.grant ? "Make administrator" : "Remove administrator access"}</DialogTitle>
            <DialogDescription>
              {action?.kind === "status"
                ? `${name}: ${COPY[action.status].body}`
                : action?.grant
                  ? `${name} will be able to review applications, manage users, see payments and read the audit log. Only do this for someone you fully trust.`
                  : `${name} will lose all administrator access and return to their previous role.`}
            </DialogDescription>
          </DialogHeader>
          {needsReason && (
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required). This is recorded and shown to the user." className="min-h-24 rounded-lg" maxLength={500} aria-label="Reason" />
          )}
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" className="rounded-lg" onClick={close} disabled={busy}>Cancel</Button>
            <Button
              variant={action?.kind === "status" && action.status !== "ACTIVE" ? "destructive" : "default"}
              className="rounded-lg"
              disabled={busy || (needsReason && reason.trim().length < 5)}
              onClick={run}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {action?.kind === "status" ? COPY[action.status].confirm : action?.grant ? "Make administrator" : "Remove access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
