"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";

interface ProfileData {
  professionalTitle: string | null;
  qualifications: string | null;
  clinicalInterests: string[];
  conditionsTreated: string[];
  proceduresPerformed: string[];
  patientCarePhilosophy: string | null;
  consultationApproach: string | null;
  whenToBookGuidance: string | null;
  consultationModes: string[];
  linkedinUrl: string | null;
  linkedinPublic: boolean;
  cvFileName: string | null;
  cvFileId: string | null;
  licensingAuthority: string | null;
  licenseExpiry: string | null;
  professionalMemberships: string[];
  awards: string[];
  hospitalAffiliations: string[];
}

const MODES = [
  { value: "CHAT", label: "Chat" },
  { value: "VIDEO", label: "Video" },
  { value: "IN_PERSON", label: "In person" },
] as const;

const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
const textarea = "min-h-24 w-full rounded-lg border border-input bg-background p-2 text-sm";

/** The doctor's own professional profile: what patients see, with consent-controlled publishing. */
export function ProfessionalProfileForm({ initial }: { initial: ProfileData }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.professionalTitle ?? "");
  const [qualifications, setQualifications] = useState(initial.qualifications ?? "");
  const [interests, setInterests] = useState(initial.clinicalInterests.join(", "));
  const [conditions, setConditions] = useState(initial.conditionsTreated.join(", "));
  const [procedures, setProcedures] = useState(initial.proceduresPerformed.join(", "));
  const [philosophy, setPhilosophy] = useState(initial.patientCarePhilosophy ?? "");
  const [approach, setApproach] = useState(initial.consultationApproach ?? "");
  const [guidance, setGuidance] = useState(initial.whenToBookGuidance ?? "");
  const [modes, setModes] = useState<string[]>(initial.consultationModes);
  const [linkedinUrl, setLinkedinUrl] = useState(initial.linkedinUrl ?? "");
  const [linkedinPublic, setLinkedinPublic] = useState(initial.linkedinPublic);
  const [cvFileId, setCvFileId] = useState<string | null>(initial.cvFileId);
  const [cvFileName, setCvFileName] = useState<string | null>(initial.cvFileName);
  const [licensingAuthority, setLicensingAuthority] = useState(initial.licensingAuthority ?? "");
  const [licenseExpiry, setLicenseExpiry] = useState(initial.licenseExpiry ?? "");
  const [memberships, setMemberships] = useState(initial.professionalMemberships.join(", "));
  const [awards, setAwards] = useState(initial.awards.join(", "));
  const [affiliations, setAffiliations] = useState(initial.hospitalAffiliations.join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const split = (value: string) => value.split(",").map((v) => v.trim()).filter(Boolean);

  const uploadCv = async (file: File) => {
    setError("");
    try {
      const initiated = await apiClient.post<{ key: string; uploadUrl: string; method: string; headers: Record<string, string> }>("/doctors/me/files", {
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      const put = await fetch(initiated.uploadUrl, { method: initiated.method, headers: initiated.headers, body: file });
      if (!put.ok) throw new Error("The file storage rejected the upload");
      const confirmed = await apiClient.post<{ file: { id: string; fileName: string } }>("/doctors/me/files/confirm", {
        key: initiated.key,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
      });
      setCvFileId(confirmed.file.id);
      setCvFileName(confirmed.file.fileName);
      toast.success("CV uploaded. Remember to save.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The CV could not be uploaded");
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await apiClient.put("/doctors/me/profile", {
        professionalTitle: title || null,
        qualifications: qualifications || null,
        clinicalInterests: split(interests),
        conditionsTreated: split(conditions),
        proceduresPerformed: split(procedures),
        patientCarePhilosophy: philosophy || null,
        consultationApproach: approach || null,
        whenToBookGuidance: guidance || null,
        consultationModes: modes,
        linkedinUrl: linkedinUrl || null,
        linkedinPublic,
        cvFileId,
        licensingAuthority: licensingAuthority || null,
        licenseExpiry: licenseExpiry || null,
        professionalMemberships: split(memberships),
        awards: split(awards),
        hospitalAffiliations: split(affiliations),
      });
      toast.success("Profile saved");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={save}>
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Professional title</span>
            <Input className={field} placeholder="e.g. Consultant Cardiologist" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Label>
          <Label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Qualifications</span>
            <Input className={field} placeholder="e.g. MBBS, FWACS" value={qualifications} onChange={(e) => setQualifications(e.target.value)} />
          </Label>
          <Label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Clinical interests (comma-separated)</span>
            <Input className={field} value={interests} onChange={(e) => setInterests(e.target.value)} />
          </Label>
          <Label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Conditions treated (comma-separated)</span>
            <Input className={field} value={conditions} onChange={(e) => setConditions(e.target.value)} />
          </Label>
          <Label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Procedures performed (comma-separated)</span>
            <Input className={field} value={procedures} onChange={(e) => setProcedures(e.target.value)} />
          </Label>
          <Label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Consultation modes you offer</span>
            <div className="flex flex-wrap gap-3">
              {MODES.map((m) => (
                <label key={m.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-foreground"
                    checked={modes.includes(m.value)}
                    onChange={(e) => setModes((prev) => (e.target.checked ? [...prev, m.value] : prev.filter((v) => v !== m.value)))}
                  />
                  {m.label}
                </label>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">Leave all unchecked to offer the platform&rsquo;s default modes.</span>
          </Label>
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">About text</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Patient-care philosophy</span>
            <textarea className={textarea} value={philosophy} onChange={(e) => setPhilosophy(e.target.value)} />
          </Label>
          <Label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Consultation approach</span>
            <textarea className={textarea} value={approach} onChange={(e) => setApproach(e.target.value)} />
          </Label>
          <Label className="block space-y-1">
            <span className="text-xs text-muted-foreground">When patients should book you (plain language)</span>
            <textarea className={textarea} value={guidance} onChange={(e) => setGuidance(e.target.value)} />
          </Label>
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Credentials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Licensing authority</span>
            <Input className={field} value={licensingAuthority} onChange={(e) => setLicensingAuthority(e.target.value)} />
          </Label>
          <Label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Licence expiry</span>
            <Input type="date" className={field} value={licenseExpiry ?? ""} onChange={(e) => setLicenseExpiry(e.target.value)} />
          </Label>
          <Label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Professional memberships (comma-separated)</span>
            <Input className={field} value={memberships} onChange={(e) => setMemberships(e.target.value)} />
          </Label>
          <Label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Awards (comma-separated)</span>
            <Input className={field} value={awards} onChange={(e) => setAwards(e.target.value)} />
          </Label>
          <Label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Hospital affiliations (comma-separated)</span>
            <Input className={field} value={affiliations} onChange={(e) => setAffiliations(e.target.value)} />
          </Label>
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">CV and LinkedIn</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">CV (PDF or document)</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept="application/pdf,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadCv(file);
                }}
              />
              <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-1 h-4 w-4" /> {cvFileName ? "Replace CV" : "Upload CV"}
              </Button>
              {cvFileName && <span className="text-sm text-muted-foreground">{cvFileName}</span>}
            </div>
          </div>
          <Label className="block space-y-1">
            <span className="text-xs text-muted-foreground">LinkedIn profile URL</span>
            <Input className={field} placeholder="https://www.linkedin.com/in/…" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} />
          </Label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-foreground"
              checked={linkedinPublic}
              onChange={(e) => setLinkedinPublic(e.target.checked)}
            />
            <span>
              Show the LinkedIn link on my public profile
              <span className="block text-xs text-muted-foreground">
                Your consent to show the link is recorded when you save. The platform never imports or publishes LinkedIn content on your behalf.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="bg-foreground text-background rounded-lg" disabled={saving} type="submit">
        {saving ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
