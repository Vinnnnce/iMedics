"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { FormField } from "@/components/shared/form-field";
import { ROLE_POLICY } from "@/lib/roles";
import { SignOutButton } from "@/components/shared/sign-out-button";
import type { Role } from "@prisma/client";

interface Props {
  email: string;
  role: string;
  verificationStatus: string | null;
  initial: { name: string; phone: string; language: string };
}

const field = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm";
const LANGUAGES = [["en", "English"], ["fr", "Français"], ["es", "Español"], ["ru", "Русский"]] as const;

export function ProfileForm({ email, role, verificationStatus, initial }: Props) {
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setMessage(null);
      try {
        await apiClient.patch("/me", { name: form.name, phone: form.phone.trim() || null, language: form.language });
        setMessage({ type: "ok", text: "Profile saved." });
      } catch (e) {
        setMessage({ type: "error", text: e instanceof Error ? e.message : "Could not save your profile" });
      }
    });

  return (
    <div className="space-y-6">
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Account <Badge variant="secondary" className="rounded-lg">{ROLE_POLICY[role as Role]?.label ?? role}</Badge>
            {verificationStatus && <Badge variant="outline" className="rounded-lg">{verificationStatus === "VERIFIED" ? "Verified" : verificationStatus === "PENDING" ? "Verification pending" : "Verification rejected"}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="block text-xs text-muted-foreground">Email
            <input className={`${field} mt-1 bg-muted`} value={email} disabled />
          </label>
          <FormField label="Name" required error={!form.name.trim() ? "Enter your name to save changes." : undefined}>
            <input className={field} autoComplete="name" required value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label="Phone">
            <input className={field} type="tel" autoComplete="tel" value={form.phone} maxLength={30} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </FormField>
          <label className="block text-xs text-muted-foreground">Language
            <select className={`${field} mt-1`} value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
              {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-3">
            <Button className="bg-foreground text-background rounded-lg" disabled={pending || !form.name.trim()} onClick={save}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
            {message && <p role={message.type === "error" ? "alert" : "status"} className="text-sm text-foreground">{message.text}</p>}
          </div>
        </CardContent>
      </Card>

      <SignOutButton />
    </div>
  );
}
