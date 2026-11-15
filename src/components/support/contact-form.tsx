"use client";

import { useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";
import { useMe } from "@/lib/use-me";
import { PUBLIC_SUPPORT_TYPES, SUPPORT_TYPES, SUPPORT_TYPE_LABELS } from "@/lib/support";

const selectClass = "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * One form for everyone. Signed-in people file a ticket under their own account (and may report
 * record problems); visitors use the public form with a name and email.
 */
export function ContactForm({ initialType }: { initialType?: string }) {
  const me = useMe();
  const pathname = usePathname();
  const types = me ? SUPPORT_TYPES : PUBLIC_SUPPORT_TYPES;
  const startType = (types as readonly string[]).includes(initialType ?? "") ? (initialType as string) : me ? "TECHNICAL" : "CONTACT";
  const [type, setType] = useState(startType);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const common = { type, subject: String(form.get("subject") ?? ""), message: String(form.get("message") ?? ""), pagePath: document.referrer ? new URL(document.referrer).pathname : pathname };
      const result = me
        ? await apiClient.post<{ reference: string }>("/support/tickets", common)
        : await apiClient.post<{ reference: string }>("/support/contact", { ...common, name: String(form.get("name") ?? ""), email: String(form.get("email") ?? ""), website: String(form.get("website") ?? "") });
      setReference(result.reference);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send your message. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (reference) {
    return (
      <div role="status" className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Message received</h2>
        <p className="mt-2 text-sm text-muted-foreground">Your reference is <strong className="text-foreground">{reference}</strong>. Please quote it if you contact us again.</p>
        <p className="mt-2 text-sm text-muted-foreground">If this is a medical emergency, contact your local emergency services now. Do not wait for a reply.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate={false}>
      <div className="space-y-2">
        <Label htmlFor="support-type">What is this about?</Label>
        <select id="support-type" value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
          {types.map((t) => <option key={t} value={t}>{SUPPORT_TYPE_LABELS[t]}</option>)}
        </select>
      </div>
      {!me && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="support-name">Your name</Label><Input id="support-name" name="name" required minLength={2} maxLength={120} autoComplete="name" /></div>
          <div className="space-y-2"><Label htmlFor="support-email">Email</Label><Input id="support-email" name="email" type="email" required maxLength={254} autoComplete="email" /></div>
        </div>
      )}
      {/* Honeypot: hidden from people and assistive technology. */}
      {!me && <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>}
      <div className="space-y-2"><Label htmlFor="support-subject">Subject</Label><Input id="support-subject" name="subject" required minLength={3} maxLength={160} /></div>
      <div className="space-y-2">
        <Label htmlFor="support-message">Message</Label>
        <Textarea id="support-message" name="message" required minLength={10} maxLength={5000} rows={6} aria-describedby="support-privacy" />
        <p id="support-privacy" className="text-xs text-muted-foreground">Please do not include diagnoses, results or other health details. Support will tell you how to share them safely if needed.</p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending} className="rounded-lg">{pending ? "Sending…" : "Send message"}</Button>
    </form>
  );
}
