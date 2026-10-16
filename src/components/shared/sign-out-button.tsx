"use client";
import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clearDevicePush } from "@/lib/notifications/device";

/** Available even when a blocked account cannot enter protected profile routes. */
export function SignOutButton() {
  const { signOut } = useClerk();
  const [pending, setPending] = useState(false);
  async function handleSignOut() {
    setPending(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        clearDevicePush(),
        new Promise<void>(resolve => { timer = setTimeout(resolve, 3500); }),
      ]);
    } catch { /* Browser cleanup must not prevent session revocation. */ }
    finally { if (timer) clearTimeout(timer); }
    try { await signOut({ redirectUrl: "/auth/login" }); }
    catch { toast.error("Could not sign out. Please reconnect and try again."); }
    finally { setPending(false); }
  }
  return <Button variant="outline" className="rounded-lg" disabled={pending} onClick={handleSignOut}>
    <LogOut aria-hidden="true" className="mr-2 h-4 w-4" />{pending ? "Signing out…" : "Sign out"}
  </Button>;
}
