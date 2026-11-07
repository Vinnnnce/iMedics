"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  patientSchema,
  type PatientFormData,
} from "@/lib/validations";
import { calculateBMI, getBMIColor } from "@/lib/bmi";
import { apiClient, ApiError } from "@/lib/api-client";
import { ArrowLeft, Save, UserPlus, AlertCircle, UserCheck, Copy } from "lucide-react";

type DuplicateMatch = {
  id: string;
  caseNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
};

export default function NewPatientPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[] | null>(null);
  const form = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      middleName: "",
      // The server assigns the real case number when the patient is saved; this value is ignored.
      caseNumber: "Assigned on save",
      gender: undefined,
      dateOfBirth: "",
      height: undefined,
      weight: undefined,
      occupation: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "RU",
      ecName: "",
      ecRelationship: "",
      ecPhone: "",
      ecAddress: "",
    },
  });

  // Watch height and weight for BMI calculation
  const height = useWatch({ control: form.control, name: "height" });
  const weight = useWatch({ control: form.control, name: "weight" });

  // Derived from the watched values: no state or effect needed.
  const bmiResult = calculateBMI(height, weight);

  async function onSubmit(values: PatientFormData) {
    setSubmitting(true);
    setError(null);
    setDuplicateMatches(null);
    try {
      const patient = await apiClient.post<{ id: string }>(
        "/patients",
        values
      );
      router.push(`/patients/${patient.id}`);
    } catch (err) {
      // Duplicate review: the server found possible existing records with the
      // same name and date of birth. The doctor decides — link an existing
      // record to their care, or confirm this is a different person.
      if (err instanceof ApiError && err.status === 409) {
        const matches = (err.body as { matches?: DuplicateMatch[] } | undefined)?.matches;
        if (matches && matches.length > 0) {
          setDuplicateMatches(matches);
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : "Failed to create patient");
      }
    } finally {
      setSubmitting(false);
    }
  }

  /** The doctor confirmed none of the matches is this patient. */
  async function registerAnyway() {
    const values = form.getValues();
    setSubmitting(true);
    setError(null);
    try {
      const patient = await apiClient.post<{ id: string }>("/patients", { ...values, force: true });
      router.push(`/patients/${patient.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create patient");
    } finally {
      setSubmitting(false);
      setDuplicateMatches(null);
    }
  }

  /** The doctor recognised an existing record — reuse that patient identity. */
  async function linkExisting(patientId: string) {
    const values = form.getValues();
    setSubmitting(true);
    setError(null);
    try {
      const patient = await apiClient.post<{ id: string }>("/patients", { ...values, linkTo: patientId });
      router.push(`/patients/${patient.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add the existing patient");
    } finally {
      setSubmitting(false);
      setDuplicateMatches(null);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/patients")}
          data-testid="button-back-patients"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">New Patient Registration</h1>
          <p className="text-sm text-muted-foreground">
            Register a new patient and create their clinical record
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Duplicate review — possible existing records with the same name and
          date of birth. The doctor links an existing record or confirms this
          is a different person before a new record is created. */}
      {duplicateMatches && duplicateMatches.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <Copy className="h-4 w-4" />
              Possible existing patient records
            </CardTitle>
            <CardDescription>
              Patients with the same name and date of birth are already registered. Creating
              another record would duplicate their medical history — add the existing record
              to your care instead, or confirm this is a different person.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {duplicateMatches.map((match) => (
              <div
                key={match.id}
                className="flex flex-col items-start justify-between gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="text-sm font-medium">
                    {match.firstName} {match.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Case <span className="font-mono">{match.caseNumber}</span> — born{" "}
                    {new Date(match.dateOfBirth).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  disabled={submitting}
                  onClick={() => linkExisting(match.id)}
                  data-testid={`button-link-patient-${match.caseNumber}`}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Add to my care
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={registerAnyway}
              data-testid="button-register-anyway"
            >
              This is a different person — register a new record
            </Button>
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Patient Identification */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-foreground" />
                Patient Identification
              </CardTitle>
              <CardDescription>
                Basic patient information and demographics
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} data-testid="input-firstName" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} data-testid="input-lastName" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="middleName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Middle Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Michael" {...field} data-testid="input-middleName" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="caseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Case Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        readOnly
                        className="font-mono"
                        data-testid="input-caseNumber"
                      />
                    </FormControl>
                    <FormDescription>Assigned automatically when you save</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-gender">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-dateOfBirth" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="height"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Height (cm)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="30"
                        max="300"
                        placeholder="170"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value
                              ? parseFloat(e.target.value)
                              : undefined
                          )
                        }
                        data-testid="input-height"
                      />
                    </FormControl>
                    <FormDescription>Range: 30-300 cm</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (kg)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="1"
                        max="500"
                        placeholder="70"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value
                              ? parseFloat(e.target.value)
                              : undefined
                          )
                        }
                        data-testid="input-weight"
                      />
                    </FormControl>
                    <FormDescription>Range: 1-500 kg</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>BMI</FormLabel>
                <div className="flex h-8 items-center gap-2">
                  {bmiResult ? (
                    <>
                      <span className="text-sm font-medium">
                        {bmiResult.value}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${getBMIColor(
                          bmiResult.category
                        )}`}
                      >
                        {bmiResult.label}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Auto-calculated
                    </span>
                  )}
                </div>
                <FormDescription>
                  BMI = weight(kg) / [height(m)]²
                </FormDescription>
              </FormItem>
              <FormField
                control={form.control}
                name="occupation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Occupation</FormLabel>
                    <FormControl>
                      <Input placeholder="Engineer" {...field} data-testid="input-occupation" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader>
              <CardTitle>Address</CardTitle>
              <CardDescription>Patient residential address</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="addressLine1"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Address Line 1</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main St" {...field} data-testid="input-addressLine1" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="addressLine2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 2</FormLabel>
                    <FormControl>
                      <Input placeholder="Apt 4B" {...field} data-testid="input-addressLine2" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="Moscow" {...field} data-testid="input-city" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State/Province</FormLabel>
                    <FormControl>
                      <Input placeholder="Moscow Oblast" {...field} data-testid="input-state" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal Code</FormLabel>
                    <FormControl>
                      <Input placeholder="101000" {...field} data-testid="input-postalCode" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card>
            <CardHeader>
              <CardTitle>Emergency Contact</CardTitle>
              <CardDescription>
                Person to contact in case of emergency
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="ecName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Doe" {...field} data-testid="input-ecName" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ecRelationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship</FormLabel>
                    <FormControl>
                      <Input placeholder="Spouse" {...field} data-testid="input-ecRelationship" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ecPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+7 999 123 45 67" {...field} data-testid="input-ecPhone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ecAddress"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 lg:col-span-3">
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Same as patient" {...field} data-testid="input-ecAddress" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/patients")}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="gap-1.5"
              data-testid="button-submit-patient"
            >
              <Save className="h-4 w-4" />
              {submitting ? "Saving..." : "Register Patient"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
