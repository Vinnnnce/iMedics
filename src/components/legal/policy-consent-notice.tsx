"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useMe } from "@/lib/use-me";
import { Button } from "@/components/ui/button";
/** Only a legally published release can request re-consent. Drafts never do. */
export function PolicyConsentNotice() {
  const me = useMe();
  const [version, setVersion] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!me?.onboardingComplete || me.status !== "ACTIVE") return;
    let active = true;
    fetch("/api/me/policies").then(r => r.ok ? r.json() : null).then(data => { if (active && data?.requiresConsent) setVersion(data.current.version); }).catch(() => {});
    return () => { active = false; };
  }, [me?.id, me?.onboardingComplete, me?.status]);
  if (!version) return null;
  async function accept() {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/me/policies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version, accepted: true }) });
      if (!response.ok) throw new Error("Unable to save acceptance. Review the current policy version and try again.");
      setVersion(null);
    } catch (cause) { setError((cause as Error).message); } finally { setPending(false); }
  }
  return <aside className="m-4 rounded-xl border border-border bg-card p-5" aria-label="Updated policy review">
    <h2 className="font-semibold">Please review the updated policies</h2>
    <p className="my-3 text-sm text-muted-foreground">Version {version} contains material changes. Read the <Link className="underline" href="/legal/terms">Terms of Use</Link> and <Link className="underline" href="/legal/privacy">Privacy Policy</Link> for your account. Your existing care access is not interrupted by this notice.</p>
    <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />I have reviewed and accept this published version.</label>
    <Button disabled={!checked || pending} onClick={accept}>{pending ? "Saving…" : "Accept updated policies"}</Button>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  </aside>;
}
