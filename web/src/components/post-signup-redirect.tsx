"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Shield, FileText, Cookie, CheckCircle2, Stethoscope, Heart,
  FlaskConical, Building2, Hospital, Microscope, Upload,
  ArrowRight, ArrowLeft, Loader2, AlertCircle, BadgeCheck,
  User, Phone, Calendar, FileCheck, X,
} from "lucide-react";

type Step = "loading" | "terms" | "account-type" | "registration" | "pending";

type AccountType = "patient" | "doctor" | "laboratory" | "diagnostic_centre" | "hospital" | null;

type UploadedDoc = {
  name: string;
  url: string;
  size: number;
};

type RegistrationData = {
  // Common fields
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  address: string;
  city: string;
  state: string;
  // Doctor-specific (MDCN)
  mdcnRegistrationNumber: string;
  mdcnLicenseNumber: string;
  yearOfRegistration: string;
  specialty: string;
  yearsOfExperience: string;
  affiliation: string;
  biography: string;
  // Organisation-specific (CAC)
  cacRegistrationNumber: string;
  organisationName: string;
  organisationType: string;
  facilityLicenseNumber: string;
  // Patient-specific
  bloodGroup: string;
  genotype: string;
  allergies: string;
  chronicConditions: string;
  occupation: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  // Documents
  documents: UploadedDoc[];
};

const STORAGE_KEY = "medic1905_registration_form";

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT (Abuja)", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
  "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

const DOCTOR_SPECIALTIES = [
  "General Medicine", "Internal Medicine", "Cardiology", "Dermatology",
  "Endocrinology", "Gastroenterology", "Haematology", "Nephrology",
  "Neurology", "Obstetrics & Gynaecology", "Oncology", "Ophthalmology",
  "Orthopaedic Surgery", "Paediatrics", "Psychiatry", "Pulmonology",
  "Radiology", "Surgery", "Urology", "Dental Surgery", "Family Medicine",
  "Community Medicine", "Emergency Medicine", "Anaesthesiology",
  "Pathology", "Microbiology",
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENOTYPES = ["AA", "AS", "SS", "AC", "SC", "CC"];

const DEFAULT_REG_DATA: RegistrationData = {
  firstName: "", lastName: "", middleName: "", email: "", phone: "",
  gender: "", dateOfBirth: "", address: "", city: "", state: "",
  mdcnRegistrationNumber: "", mdcnLicenseNumber: "", yearOfRegistration: "",
  specialty: "", yearsOfExperience: "", affiliation: "", biography: "",
  cacRegistrationNumber: "", organisationName: "", organisationType: "",
  facilityLicenseNumber: "",
  bloodGroup: "", genotype: "", allergies: "", chronicConditions: "",
  occupation: "",
  emergencyContactName: "", emergencyContactRelationship: "",
  emergencyContactPhone: "",
  documents: [],
};

// Validate Nigerian phone number
function isValidNigerianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, "");
  // Match +234 8XX XXX XXXX or 0 8XX XXX XXXX or 8XX XXX XXXX
  return /^(\+?234|0)?[789][01]\d{8}$/.test(cleaned);
}

function formatPhoneInput(value: string): string {
  // Strip non-digits except leading +
  let v = value.replace(/[^\d+]/g, "");
  if (v.startsWith("+234")) {
    v = "+234 " + v.slice(4);
  } else if (v.startsWith("0")) {
    v = "0" + v.slice(1);
  }
  return v;
}

export default function PostSignupRedirect() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const [step, setStep] = useState<Step>("loading");
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedCookies, setAcceptedCookies] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  const [regData, setRegData] = useState<RegistrationData>(DEFAULT_REG_DATA);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Load form data from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setRegData({ ...DEFAULT_REG_DATA, ...parsed });
      }
    } catch {}
  }, []);

  // Save form data to sessionStorage whenever it changes
  const persistData = useCallback((data: RegistrationData) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }, []);

  const updateField = useCallback((field: keyof RegistrationData, value: string) => {
    setRegData((prev) => {
      const next = { ...prev, [field]: value };
      persistData(next);
      return next;
    });
    // Clear field error when user types
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }, [fieldErrors, persistData]);

  // Handle document upload
  const handleFileUpload = (docKey: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError("File too large. Maximum size is 5MB.");
      return;
    }
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!allowed.includes(file.type)) {
      setError("Only PDF, JPG, and PNG files are allowed.");
      return;
    }
    // Create object URL for preview
    const url = URL.createObjectURL(file);
    const doc: UploadedDoc = { name: file.name, url, size: file.size };
    setRegData((prev) => {
      const next = { ...prev, documents: [...prev.documents, doc] };
      persistData(next);
      return next;
    });
    setError("");
  };

  const removeDocument = (idx: number) => {
    setRegData((prev) => {
      const docs = [...prev.documents];
      URL.revokeObjectURL(docs[idx].url);
      docs.splice(idx, 1);
      const next = { ...prev, documents: docs };
      persistData(next);
      return next;
    });
  };

  // Determine the step based on user state
  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      router.push("/auth/login");
      return;
    }

    // Pre-fill email from Clerk
    const clerkEmail = user.emailAddresses?.[0]?.emailAddress || "";
    const clerkFirstName = user.firstName || "";
    const clerkLastName = user.lastName || "";
    if (clerkEmail && regData.email !== clerkEmail) {
      setRegData((prev) => {
        const next = { ...prev, email: clerkEmail, firstName: clerkFirstName, lastName: clerkLastName };
        persistData(next);
        return next;
      });
    }

    const role = (user.publicMetadata as Record<string, unknown>)?.role as string ||
      (user.unsafeMetadata as Record<string, unknown>)?.role as string;
    const termsAccepted = (user.unsafeMetadata as Record<string, unknown>)?.termsAccepted as boolean;
    const registrationComplete = (user.unsafeMetadata as Record<string, unknown>)?.registrationComplete as boolean;
    const registrationStatus = (user.unsafeMetadata as Record<string, unknown>)?.registrationStatus as string;
    const savedAccountType = (user.unsafeMetadata as Record<string, unknown>)?.accountType as string;

    if (role && registrationComplete && registrationStatus === "pending") {
      setStep("pending");
      return;
    }

    if (role && registrationComplete) {
      switch (role) {
        case "DOCTOR":
          router.push("/doctor/dashboard");
          break;
        case "LAB_SCIENTIST":
          router.push("/lab/dashboard");
          break;
        case "ADMIN":
          router.push("/admin/dashboard");
          break;
        default:
          router.push("/dashboard");
      }
      return;
    }

    if (role && termsAccepted && !registrationComplete) {
      // Restore account type if previously selected
      if (savedAccountType) {
        setAccountType(savedAccountType as AccountType);
      }
      setStep(savedAccountType ? "registration" : "account-type");
      return;
    }

    setStep("terms");
  }, [user, isLoaded, router, persistData]);

  // Go back to previous step
  const goBack = () => {
    setDirection("backward");
    setError("");
    setFieldErrors({});
    if (step === "account-type") {
      setStep("terms");
    } else if (step === "registration") {
      setStep("account-type");
    }
  };

  const handleAcceptTerms = async () => {
    if (!acceptedTerms || !acceptedPrivacy || !acceptedCookies) return;
    setSubmitting(true);
    setError("");
    try {
      await user?.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          termsAccepted: true,
          termsAcceptedDate: new Date().toISOString(),
        },
      });
      setDirection("forward");
      setStep("account-type");
    } catch {
      setError("Failed to save your acceptance. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccountTypeSelect = async () => {
    if (!accountType) return;
    setSubmitting(true);
    setError("");
    try {
      const roleMap: Record<string, string> = {
        patient: "PATIENT",
        doctor: "DOCTOR",
        laboratory: "LAB_SCIENTIST",
        diagnostic_centre: "LAB_SCIENTIST",
        hospital: "LAB_SCIENTIST",
      };

      await user?.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          role: roleMap[accountType],
          accountType: accountType,
        },
      });
      setDirection("forward");
      setStep("registration");
    } catch {
      setError("Failed to save your selection. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Common required fields
    if (!regData.firstName.trim()) errors.firstName = "First name is required";
    if (!regData.lastName.trim()) errors.lastName = "Last name is required";
    if (!regData.phone.trim()) {
      errors.phone = "Phone number is required";
    } else if (!isValidNigerianPhone(regData.phone)) {
      errors.phone = "Enter a valid Nigerian phone number (e.g., +234 803 123 4567)";
    }
    if (!regData.gender) errors.gender = "Gender is required";
    if (!regData.dateOfBirth) errors.dateOfBirth = "Date of birth is required";
    if (!regData.address.trim()) errors.address = "Address is required";
    if (!regData.city.trim()) errors.city = "City is required";
    if (!regData.state) errors.state = "State is required";

    // Doctor-specific validation
    if (accountType === "doctor") {
      if (!regData.mdcnRegistrationNumber.trim())
        errors.mdcnRegistrationNumber = "MDCN Registration Number is required";
      if (!regData.mdcnLicenseNumber.trim())
        errors.mdcnLicenseNumber = "MDCN License Number is required";
      if (!regData.yearOfRegistration) {
        errors.yearOfRegistration = "Year of registration is required";
      } else {
        const yr = parseInt(regData.yearOfRegistration);
        if (yr < 1950 || yr > new Date().getFullYear()) {
          errors.yearOfRegistration = `Year must be between 1950 and ${new Date().getFullYear()}`;
        }
      }
      if (!regData.specialty) errors.specialty = "Specialty is required";
    }

    // Organisation-specific validation
    if (accountType === "laboratory" || accountType === "diagnostic_centre" || accountType === "hospital") {
      if (!regData.organisationName.trim())
        errors.organisationName = "Organisation name is required";
      if (!regData.cacRegistrationNumber.trim())
        errors.cacRegistrationNumber = "CAC Registration Number is required";
      if (!regData.facilityLicenseNumber.trim())
        errors.facilityLicenseNumber = "Facility License Number is required";
    }

    // Patient-specific validation
    if (accountType === "patient") {
      if (!regData.emergencyContactName.trim())
        errors.emergencyContactName = "Emergency contact name is required";
      if (!regData.emergencyContactPhone.trim()) {
        errors.emergencyContactPhone = "Emergency contact phone is required";
      } else if (!isValidNigerianPhone(regData.emergencyContactPhone)) {
        errors.emergencyContactPhone = "Enter a valid Nigerian phone number";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegistrationSubmit = async () => {
    setError("");

    if (!validateForm()) {
      setError("Please correct the errors highlighted below.");
      return;
    }

    setSubmitting(true);

    try {
      // Save registration data to user metadata
      await user?.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          registrationComplete: true,
          registrationStatus: "pending",
          registrationData: regData,
          registrationDate: new Date().toISOString(),
        },
      });

      // Save to database via API
      const allergiesList = regData.allergies
        ? regData.allergies.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const chronicConditionsList = regData.chronicConditions
        ? regData.chronicConditions.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      await fetch("/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...regData,
          accountType,
          allergies: allergiesList,
          chronicConditions: chronicConditionsList,
        }),
      }).catch(() => {});

      // Clear sessionStorage
      sessionStorage.removeItem(STORAGE_KEY);

      setDirection("forward");
      setStep("pending");
    } catch {
      setError("Failed to submit registration. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const isOrganisation = accountType === "laboratory" || accountType === "diagnostic_centre" || accountType === "hospital";
  const requiresVerification = accountType === "doctor" || isOrganisation;

  // Step definitions for progress stepper
  const steps = [
    { label: "Terms", key: "terms" },
    { label: "Account Type", key: "account-type" },
    { label: "Details", key: "registration" },
    { label: "Review", key: "pending" },
  ];
  const currentStepIndex = steps.findIndex((s) => s.key === step);

  // Progress Stepper component
  const ProgressStepper = () => {
    if (step === "loading" || step === "pending") return null;
    return (
      <div className="w-full max-w-2xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          {steps.slice(0, 3).map((s, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (
              <div key={s.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all shrink-0 ${
                      isCompleted
                        ? "border-foreground bg-foreground text-background"
                        : isCurrent
                        ? "border-foreground bg-background text-foreground"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-semibold">{idx + 1}</span>
                    )}
                  </div>
                  <span className={`text-xs hidden sm:block ${isCurrent ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </div>
                {idx < 2 && (
                  <div className={`flex-1 h-0.5 mx-2 transition-colors ${isCompleted ? "bg-foreground" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Reusable field error display
  const FieldError = ({ name }: { name: string }) =>
    fieldErrors[name] ? (
      <p className="text-xs text-destructive mt-1">{fieldErrors[name]}</p>
    ) : null;

  // Reusable document upload card
  const DocUpload = ({ docKey, label, description }: { docKey: string; label: string; description: string }) => {
    const uploaded = regData.documents.filter((d) => d.name.toLowerCase().includes(docKey.toLowerCase()));
    return (
      <div className="rounded-lg border-2 border-dashed border-border p-4 text-center hover:border-primary/30 transition-colors">
        <input
          ref={(el) => { fileInputRefs.current[docKey] = el; }}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(docKey, file);
            e.target.value = "";
          }}
        />
        {uploaded.length > 0 ? (
          <div className="space-y-2">
            <FileCheck className="mx-auto h-8 w-8 text-foreground" />
            {uploaded.map((doc, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                <span className="text-xs font-medium truncate">{doc.name}</span>
                <button
                  type="button"
                  onClick={() => removeDocument(regData.documents.indexOf(doc))}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => fileInputRefs.current[docKey]?.click()}
            >
              Replace
            </Button>
          </div>
        ) : (
          <>
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 rounded-lg"
              onClick={() => fileInputRefs.current[docKey]?.click()}
            >
              Upload
            </Button>
          </>
        )}
      </div>
    );
  };

  // === LOADING STEP ===
  if (step === "loading") {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // === TERMS ACCEPTANCE STEP ===
  if (step === "terms") {
    return (
      <div className="min-h-[calc(100vh-4rem)] py-8 px-4">
        <ProgressStepper />
        <div className="flex items-center justify-center">
          <div className="w-full max-w-lg">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-foreground">
                <Shield className="h-7 w-7 text-background" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Welcome to Medic1905</h1>
              <p className="text-sm text-muted-foreground mt-1">Please review and accept our policies to continue</p>
            </div>

            <Card className="beeline-card">
              <CardContent className="space-y-4 p-4 sm:p-6">
                {/* Terms of Use */}
                <div className="flex items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:border-foreground/20">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">Terms of Use</p>
                      <Switch checked={acceptedTerms} onCheckedChange={setAcceptedTerms} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      I agree to the{" "}
                      <Link href="/legal/terms" className="underline text-foreground" target="_blank">Terms of Use</Link>
                      {" "}including the platform-only disclaimer and AI content disclaimer.
                    </p>
                  </div>
                </div>

                {/* Privacy Policy */}
                <div className="flex items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:border-foreground/20">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">Privacy Policy</p>
                      <Switch checked={acceptedPrivacy} onCheckedChange={setAcceptedPrivacy} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      I agree to the{" "}
                      <Link href="/legal/privacy" className="underline text-foreground" target="_blank">Privacy Policy</Link>
                      {" "}regarding how my personal and health data is collected, used, and protected.
                    </p>
                  </div>
                </div>

                {/* Cookies Policy */}
                <div className="flex items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:border-foreground/20">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                    <Cookie className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">Cookies Policy</p>
                      <Switch checked={acceptedCookies} onCheckedChange={setAcceptedCookies} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      I agree to the{" "}
                      <Link href="/legal/cookies" className="underline text-foreground" target="_blank">Cookies Policy</Link>
                      {" "}regarding the use of cookies and similar technologies.
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
                    {error}
                  </div>
                )}

                <Button
                  className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-lg h-12 text-base font-bold"
                  disabled={!acceptedTerms || !acceptedPrivacy || !acceptedCookies || submitting}
                  onClick={handleAcceptTerms}
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <>Accept & Continue <ArrowRight className="h-4 w-4 ml-2" /></>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // === ACCOUNT TYPE SELECTION STEP ===
  if (step === "account-type") {
    const accountTypes = [
      {
        category: "Personal",
        items: [
          { value: "patient", label: "Patient", desc: "Book consults, view results, manage your health", icon: Heart, color: "text-muted-foreground", bgColor: "bg-muted" },
          { value: "doctor", label: "Doctor", desc: "Review patients, write consultations, prescribe", icon: Stethoscope, color: "text-foreground", bgColor: "bg-foreground/10" },
        ],
      },
      {
        category: "Organisation",
        items: [
          { value: "laboratory", label: "Laboratory", desc: "Manage lab orders, upload results, verify tests", icon: FlaskConical, color: "text-muted-foreground", bgColor: "bg-muted" },
          { value: "diagnostic_centre", label: "Diagnostic Centre", desc: "Diagnostic services, imaging, test management", icon: Microscope, color: "text-muted-foreground", bgColor: "bg-muted" },
          { value: "hospital", label: "Hospital", desc: "Hospital management, admissions, departments", icon: Hospital, color: "text-muted-foreground", bgColor: "bg-muted" },
        ],
      },
    ];

    return (
      <div className="min-h-[calc(100vh-4rem)] py-8 px-4">
        <ProgressStepper />
        <div className="flex items-center justify-center">
          <div className="w-full max-w-2xl">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-foreground">Complete Registration</h1>
              <p className="text-sm text-muted-foreground mt-1">Select the type of account you want to create</p>
            </div>

            <div className="space-y-6">
              {accountTypes.map((category) => (
                <div key={category.category}>
                  <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">{category.category}</h2>
                  <div className="space-y-3">
                    {category.items.map((item) => {
                      const Icon = item.icon;
                      const isSelected = accountType === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setAccountType(item.value as AccountType)}
                          className={`w-full text-left transition-all ${
                            isSelected
                              ? "border-2 border-foreground bg-foreground/5"
                              : "border-2 border-border hover:border-foreground/30"
                          } rounded-lg p-4`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${item.bgColor} shrink-0`}>
                              <Icon className={`h-6 w-6 ${item.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-base font-semibold">{item.label}</p>
                              <p className="text-sm text-muted-foreground">{item.desc}</p>
                            </div>
                            <div className={`h-6 w-6 rounded-full border-2 shrink-0 ${
                              isSelected ? "border-foreground bg-foreground" : "border-border"
                            }`}>
                              {isSelected && (
                                <svg viewBox="0 0 24 24" className="h-full w-full p-1 text-background" fill="none" stroke="currentColor" strokeWidth="3">
                                  <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
                {error}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <Button
                type="button"
                variant="outline"
                className="rounded-lg px-6"
                onClick={goBack}
                disabled={submitting}
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button
                type="button"
                className="flex-1 bg-foreground text-background hover:bg-foreground/90 rounded-lg h-12 text-base font-bold"
                disabled={!accountType || submitting}
                onClick={handleAccountTypeSelect}
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Setting up...</>
                ) : (
                  <>Continue <ArrowRight className="h-4 w-4 ml-2" /></>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === REGISTRATION FORM STEP ===
  if (step === "registration") {
    return (
      <div className="min-h-[calc(100vh-4rem)] py-8 px-4">
        <ProgressStepper />
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-foreground/10">
              {accountType === "doctor" && <Stethoscope className="h-7 w-7 text-foreground" />}
              {accountType === "patient" && <Heart className="h-7 w-7 text-foreground" />}
              {isOrganisation && <Building2 className="h-7 w-7 text-foreground" />}
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {accountType === "doctor" && "Doctor Registration"}
              {accountType === "patient" && "Patient Registration"}
              {accountType === "laboratory" && "Laboratory Registration"}
              {accountType === "diagnostic_centre" && "Diagnostic Centre Registration"}
              {accountType === "hospital" && "Hospital Registration"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {requiresVerification
                ? "Complete your registration for verification by our admin team"
                : "Complete your profile to get started"}
            </p>
          </div>

          {requiresVerification && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted p-4">
              <AlertCircle className="h-5 w-5 text-warning shrink-0" />
              <p className="text-xs text-muted-foreground">
                Your registration will be reviewed and verified by our admin team before activation. Please ensure all information is accurate and matches your credentials.
              </p>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleRegistrationSubmit(); }} className="space-y-6">

            {/* === COMMON: Personal Information === */}
            <Card className="beeline-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5 text-foreground" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={regData.firstName}
                      onChange={(e) => updateField("firstName", e.target.value)}
                      required
                      className={`rounded-lg ${fieldErrors.firstName ? "border-destructive" : ""}`}
                    />
                    <FieldError name="firstName" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="middleName">Middle Name</Label>
                    <Input
                      id="middleName"
                      value={regData.middleName}
                      onChange={(e) => updateField("middleName", e.target.value)}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={regData.lastName}
                      onChange={(e) => updateField("lastName", e.target.value)}
                      required
                      className={`rounded-lg ${fieldErrors.lastName ? "border-destructive" : ""}`}
                    />
                    <FieldError name="lastName" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" value={regData.email} readOnly className="rounded-lg bg-muted font-mono text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={regData.phone}
                      onChange={(e) => updateField("phone", formatPhoneInput(e.target.value))}
                      required
                      placeholder="+234 803 123 4567"
                      className={`rounded-lg ${fieldErrors.phone ? "border-destructive" : ""}`}
                    />
                    <FieldError name="phone" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender *</Label>
                    <Select value={regData.gender} onValueChange={(v) => updateField("gender", v || "")}>
                      <SelectTrigger className={`rounded-lg ${fieldErrors.gender ? "border-destructive" : ""}`}><SelectValue placeholder="Select gender" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldError name="gender" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={regData.dateOfBirth}
                      onChange={(e) => updateField("dateOfBirth", e.target.value)}
                      required
                      max={new Date().toISOString().split("T")[0]}
                      className={`rounded-lg ${fieldErrors.dateOfBirth ? "border-destructive" : ""}`}
                    />
                    <FieldError name="dateOfBirth" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Address *</Label>
                    <Textarea
                      id="address"
                      value={regData.address}
                      onChange={(e) => updateField("address", e.target.value)}
                      required
                      className={`rounded-lg ${fieldErrors.address ? "border-destructive" : ""}`}
                      rows={2}
                    />
                    <FieldError name="address" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={regData.city}
                      onChange={(e) => updateField("city", e.target.value)}
                      required
                      className={`rounded-lg ${fieldErrors.city ? "border-destructive" : ""}`}
                    />
                    <FieldError name="city" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Select value={regData.state} onValueChange={(v) => updateField("state", v || "")}>
                    <SelectTrigger className={`rounded-lg ${fieldErrors.state ? "border-destructive" : ""}`}><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent>
                      {NIGERIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FieldError name="state" />
                </div>
              </CardContent>
            </Card>

            {/* === DOCTOR-SPECIFIC: MDCN Registration === */}
            {accountType === "doctor" && (
              <Card className="beeline-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BadgeCheck className="h-5 w-5 text-foreground" />
                    MDCN Professional Credentials
                  </CardTitle>
                  <CardDescription>
                    Medical and Dental Council of Nigeria (MDCN) registration details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="mdcnReg">MDCN Registration Number *</Label>
                      <Input
                        id="mdcnReg"
                        value={regData.mdcnRegistrationNumber}
                        onChange={(e) => updateField("mdcnRegistrationNumber", e.target.value)}
                        required
                        placeholder="e.g., MDCN/R/00000"
                        className={`rounded-lg ${fieldErrors.mdcnRegistrationNumber ? "border-destructive" : ""}`}
                      />
                      <p className="text-xs text-muted-foreground">As issued by the Medical and Dental Council of Nigeria</p>
                      <FieldError name="mdcnRegistrationNumber" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mdcnLicense">MDCN License Number *</Label>
                      <Input
                        id="mdcnLicense"
                        value={regData.mdcnLicenseNumber}
                        onChange={(e) => updateField("mdcnLicenseNumber", e.target.value)}
                        required
                        placeholder="e.g., MDCN/L/00000"
                        className={`rounded-lg ${fieldErrors.mdcnLicenseNumber ? "border-destructive" : ""}`}
                      />
                      <p className="text-xs text-muted-foreground">Current practising license number</p>
                      <FieldError name="mdcnLicenseNumber" />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="yearReg">Year of MDCN Registration *</Label>
                      <Input
                        id="yearReg"
                        type="number"
                        value={regData.yearOfRegistration}
                        onChange={(e) => updateField("yearOfRegistration", e.target.value)}
                        required
                        placeholder="e.g., 2015"
                        min="1950"
                        max={new Date().getFullYear()}
                        className={`rounded-lg ${fieldErrors.yearOfRegistration ? "border-destructive" : ""}`}
                      />
                      <FieldError name="yearOfRegistration" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="yearsExp">Years of Experience</Label>
                      <Input
                        id="yearsExp"
                        type="number"
                        value={regData.yearsOfExperience}
                        onChange={(e) => updateField("yearsOfExperience", e.target.value)}
                        className="rounded-lg"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="specialty">Specialty *</Label>
                      <Select value={regData.specialty} onValueChange={(v) => updateField("specialty", v || "")}>
                        <SelectTrigger className={`rounded-lg ${fieldErrors.specialty ? "border-destructive" : ""}`}><SelectValue placeholder="Select specialty" /></SelectTrigger>
                        <SelectContent>
                          {DOCTOR_SPECIALTIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FieldError name="specialty" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="affiliation">Hospital/Clinic Affiliation</Label>
                      <Input
                        id="affiliation"
                        value={regData.affiliation}
                        onChange={(e) => updateField("affiliation", e.target.value)}
                        placeholder="e.g., Lagos University Teaching Hospital"
                        className="rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Professional Biography</Label>
                    <Textarea
                      id="bio"
                      value={regData.biography}
                      onChange={(e) => updateField("biography", e.target.value)}
                      className="rounded-lg"
                      rows={3}
                      placeholder="Brief summary of your professional background and expertise"
                    />
                  </div>

                  {/* Document Upload */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <DocUpload docKey="mdcn_certificate" label="MDCN Registration Certificate" description="PDF, JPG, PNG (max 5MB)" />
                    <DocUpload docKey="practising_license" label="Practising License" description="PDF, JPG, PNG (max 5MB)" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* === ORGANISATION-SPECIFIC: CAC Registration === */}
            {isOrganisation && (
              <Card className="beeline-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="h-5 w-5 text-foreground" />
                    Organisation Registration
                  </CardTitle>
                  <CardDescription>
                    Corporate Affairs Commission (CAC) registration and facility details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="orgName">Organisation Name *</Label>
                      <Input
                        id="orgName"
                        value={regData.organisationName}
                        onChange={(e) => updateField("organisationName", e.target.value)}
                        required
                        placeholder="e.g., Lagos Medical Laboratories Ltd"
                        className={`rounded-lg ${fieldErrors.organisationName ? "border-destructive" : ""}`}
                      />
                      <FieldError name="organisationName" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="orgType">Organisation Type *</Label>
                      <Input
                        id="orgType"
                        value={accountType === "laboratory" ? "Laboratory" : accountType === "diagnostic_centre" ? "Diagnostic Centre" : "Hospital"}
                        readOnly
                        className="rounded-lg bg-muted"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="cacReg">CAC Registration Number *</Label>
                      <Input
                        id="cacReg"
                        value={regData.cacRegistrationNumber}
                        onChange={(e) => updateField("cacRegistrationNumber", e.target.value)}
                        required
                        placeholder="e.g., RC1234567 or BN1234567"
                        className={`rounded-lg ${fieldErrors.cacRegistrationNumber ? "border-destructive" : ""}`}
                      />
                      <p className="text-xs text-muted-foreground">Corporate Affairs Commission registration number</p>
                      <FieldError name="cacRegistrationNumber" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="facilityLicense">Facility License Number *</Label>
                      <Input
                        id="facilityLicense"
                        value={regData.facilityLicenseNumber}
                        onChange={(e) => updateField("facilityLicenseNumber", e.target.value)}
                        required
                        placeholder="e.g., FML/00000"
                        className={`rounded-lg ${fieldErrors.facilityLicenseNumber ? "border-destructive" : ""}`}
                      />
                      <p className="text-xs text-muted-foreground">Ministry of Health facility license</p>
                      <FieldError name="facilityLicenseNumber" />
                    </div>
                  </div>

                  {/* Document Upload */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <DocUpload docKey="cac_certificate" label="CAC Certificate" description="PDF, JPG, PNG (max 5MB)" />
                    <DocUpload docKey="facility_license_doc" label="Facility License" description="PDF, JPG, PNG (max 5MB)" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* === PATIENT-SPECIFIC: Medical & Emergency === */}
            {accountType === "patient" && (
              <Card className="beeline-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Heart className="h-5 w-5 text-foreground" />
                    Medical Information & Emergency Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Medical info */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="bloodGroup">Blood Group</Label>
                      <Select value={regData.bloodGroup} onValueChange={(v) => updateField("bloodGroup", v || "")}>
                        <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select blood group" /></SelectTrigger>
                        <SelectContent>
                          {BLOOD_GROUPS.map((bg) => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="genotype">Genotype</Label>
                      <Select value={regData.genotype} onValueChange={(v) => updateField("genotype", v || "")}>
                        <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select genotype" /></SelectTrigger>
                        <SelectContent>
                          {GENOTYPES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="allergies">Known Allergies</Label>
                      <Input
                        id="allergies"
                        value={regData.allergies}
                        onChange={(e) => updateField("allergies", e.target.value)}
                        placeholder="Comma-separated, e.g., Penicillin, Peanuts"
                        className="rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chronicConditions">Chronic Conditions</Label>
                      <Input
                        id="chronicConditions"
                        value={regData.chronicConditions}
                        onChange={(e) => updateField("chronicConditions", e.target.value)}
                        placeholder="Comma-separated, e.g., Diabetes, Hypertension"
                        className="rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="occupation">Occupation</Label>
                    <Input
                      id="occupation"
                      value={regData.occupation}
                      onChange={(e) => updateField("occupation", e.target.value)}
                      placeholder="e.g., Teacher, Engineer"
                      className="rounded-lg"
                    />
                  </div>

                  {/* Emergency Contact */}
                  <div className="border-t border-border pt-4">
                    <p className="text-sm font-semibold mb-3">Emergency Contact</p>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="ecName">Contact Name *</Label>
                        <Input
                          id="ecName"
                          value={regData.emergencyContactName}
                          onChange={(e) => updateField("emergencyContactName", e.target.value)}
                          required
                          className={`rounded-lg ${fieldErrors.emergencyContactName ? "border-destructive" : ""}`}
                        />
                        <FieldError name="emergencyContactName" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ecRel">Relationship</Label>
                        <Input
                          id="ecRel"
                          value={regData.emergencyContactRelationship}
                          onChange={(e) => updateField("emergencyContactRelationship", e.target.value)}
                          placeholder="e.g., Spouse, Parent"
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ecPhone">Phone *</Label>
                        <Input
                          id="ecPhone"
                          type="tel"
                          value={regData.emergencyContactPhone}
                          onChange={(e) => updateField("emergencyContactPhone", formatPhoneInput(e.target.value))}
                          required
                          placeholder="+234 803 123 4567"
                          className={`rounded-lg ${fieldErrors.emergencyContactPhone ? "border-destructive" : ""}`}
                        />
                        <FieldError name="emergencyContactPhone" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Verification Notice */}
            {requiresVerification && (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted p-4">
                <BadgeCheck className="h-5 w-5 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">
                  After registration, your application will show as <strong className="text-foreground">Pending</strong> until the website admin verifies your credentials and approves your account.
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-lg px-6"
                onClick={goBack}
                disabled={submitting}
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-foreground text-background hover:bg-foreground/90 rounded-lg h-12 text-base font-bold"
                disabled={submitting}
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                ) : (
                  "Complete Registration"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // === PENDING STEP ===
  if (step === "pending") {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <div className="w-full max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-foreground/10">
            <BadgeCheck className="h-10 w-10 text-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Registration Submitted</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Your registration has been submitted successfully and is now pending review.
          </p>

          <Card className="beeline-card text-left">
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm text-muted-foreground">Application Status</span>
                <Badge className="bg-foreground/10 text-foreground rounded-lg">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Pending
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm text-muted-foreground">Account Type</span>
                <span className="text-sm font-medium capitalize">
                  {accountType === "diagnostic_centre" ? "Diagnostic Centre" : accountType}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm text-muted-foreground">Submitted</span>
                <span className="text-sm font-medium">{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>

              <div className="rounded-lg border border-border bg-muted p-4">
                <p className="text-xs text-muted-foreground">
                  Our admin team will review your credentials and verify your registration. You will receive an email notification once your account is approved. This process typically takes 1-3 business days.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="flex-1 rounded-lg"
              onClick={() => signOut({ redirectUrl: "/auth/login" })}
            >
              Sign Out
            </Button>
            {accountType === "patient" && (
              <Button
                className="flex-1 bg-foreground text-background hover:bg-foreground/90 rounded-lg"
                onClick={() => router.push("/dashboard")}
              >
                Go to Dashboard
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
