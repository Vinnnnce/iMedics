"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";

interface MyStaffProfileProps {
  staff: {
    id: string;
    fullName: string;
    email: string;
    facilityRole: string;
    status: string;
    professionalTitle: string | null;
    qualifications: string | null;
    specialty: string | null;
    yearsExperience: number | null;
    bio: string | null;
    photoUrl: string | null;
    languages: string[];
    linkedinUrl: string | null;
    linkedinPublic: boolean;
    publicProfileVisible: boolean;
    profileConsent: boolean;
    facilityName: string | null;
  };
}

/** The staff member's own profile and their consent to appear on the public portfolio. */
export function MyStaffProfile({ staff }: MyStaffProfileProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    professionalTitle: staff.professionalTitle ?? "",
    qualifications: staff.qualifications ?? "",
    specialty: staff.specialty ?? "",
    yearsExperience: staff.yearsExperience?.toString() ?? "",
    bio: staff.bio ?? "",
    linkedinUrl: staff.linkedinUrl ?? "",
    linkedinPublic: staff.linkedinPublic,
    languages: staff.languages.join(", "),
  });
  const [consent, setConsent] = useState(staff.profileConsent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(""); setSuccess("");
    try {
      await apiClient.patch("/facility/staff/me", {
        professionalTitle: form.professionalTitle || null,
        qualifications: form.qualifications || null,
        specialty: form.specialty || null,
        yearsExperience: form.yearsExperience.trim() ? Number(form.yearsExperience) : null,
        bio: form.bio || null,
        linkedinUrl: form.linkedinUrl || null,
        linkedinPublic: form.linkedinPublic,
        languages: form.languages.split(",").map((l) => l.trim()).filter(Boolean),
      });
      setSuccess("Profile saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile");
    } finally {
      setBusy(false);
    }
  };

  const toggleConsent = async (value: boolean) => {
    setBusy(true); setError("");
    try {
      await apiClient.patch("/facility/staff/me", { profileConsent: value });
      setConsent(value);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your consent");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {success && <p role="status" className="text-sm text-emerald-600">{success}</p>}

      <Card className="beeline-card">
        <CardHeader><CardTitle className="text-base">Professional profile</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="me-title">Professional title</Label>
                <Input id="me-title" maxLength={120} value={form.professionalTitle} onChange={(e) => setForm((f) => ({ ...f, professionalTitle: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="me-specialty">Specialty</Label>
                <Input id="me-specialty" maxLength={200} value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="me-qualifications">Qualifications</Label>
                <Input id="me-qualifications" maxLength={500} value={form.qualifications} onChange={(e) => setForm((f) => ({ ...f, qualifications: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="me-years">Years of experience</Label>
                <Input id="me-years" type="number" min={0} max={70} value={form.yearsExperience} onChange={(e) => setForm((f) => ({ ...f, yearsExperience: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="me-languages">Languages (comma-separated)</Label>
                <Input id="me-languages" value={form.languages} onChange={(e) => setForm((f) => ({ ...f, languages: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="me-linkedin">LinkedIn profile URL</Label>
                <Input id="me-linkedin" type="url" maxLength={300} value={form.linkedinUrl} onChange={(e) => setForm((f) => ({ ...f, linkedinUrl: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="me-bio">Short biography</Label>
              <textarea id="me-bio" className="min-h-24 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm" maxLength={1000} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.linkedinPublic} onChange={(e) => setForm((f) => ({ ...f, linkedinPublic: e.target.checked }))} className="h-4 w-4" />
              Show my LinkedIn profile publicly
            </label>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader><CardTitle className="text-base">Public directory consent</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Your profile appears on the facility&apos;s public page only when you consent{" "}
            <strong>and</strong> the facility has enabled your visibility. You can withdraw consent at any time and
            the page updates immediately. Your email, phone number and private documents are never published.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={consent}
              disabled={busy}
              onChange={(e) => toggleConsent(e.target.checked)}
              className="h-4 w-4"
            />
            I consent to my profile appearing on the public facility page
          </label>
          <p className="text-xs text-muted-foreground">
            Facility visibility switch: {staff.publicProfileVisible ? "on" : "off"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
