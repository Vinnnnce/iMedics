"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm, useFieldArray, useWatch, type Control } from "react-hook-form";
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { AIAssistantPanel } from "@/components/ai-assistant-panel";
import { SymptomCard, MedicationCard } from "@/components/history-cards";
import {
  medicalHistorySchema,
  type MedicalHistoryFormData,
} from "@/lib/validations";
import { apiClient } from "@/lib/api-client";
import {
  ChevronDown,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Activity,
  Pill,
  Bandage,
  HeartPulse,
  Users,
  History,
  Baby,
  Brain,
  Syringe,
} from "lucide-react";
import type { Prisma } from "@prisma/client";

type Patient = Prisma.PatientGetPayload<{}>;
type MedicalHistory = Prisma.MedicalHistoryGetPayload<{}>;

const TAB_SECTIONS = [
  { value: "complaint", label: "Complaint", icon: Activity },
  { value: "symptoms", label: "Symptoms", icon: AlertCircle },
  { value: "medications", label: "Medications", icon: Pill },
  { value: "wound", label: "Wound/Injury", icon: Bandage },
  { value: "chronic", label: "Chronic", icon: HeartPulse },
  { value: "family", label: "Family Hx", icon: Users },
  { value: "past", label: "Past Hx", icon: History },
  { value: "allergies", label: "Allergies", icon: AlertCircle },
  { value: "lifestyle", label: "Lifestyle", icon: Pill },
  { value: "reproductive", label: "Reproductive", icon: Baby },
  { value: "mental", label: "Mental Hx", icon: Brain },
  { value: "immunizations", label: "Immunizations", icon: Syringe },
] as const;

export default function MedicalHistoryPage() {
  const router = useRouter();
  const params = useParams<{ patientId: string }>();
  const patientId = params.patientId;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("complaint");

  const form = useForm<MedicalHistoryFormData>({
    resolver: zodResolver(medicalHistorySchema),
    defaultValues: {
      chiefComplaint: "",
      symptoms: [],
      medications: [],
      hasWound: false,
      woundLocation: "",
      woundType: "",
      woundTimeSinceInjury: "",
      woundCause: "",
      hasDiabetes: false,
      diabetesDuration: "",
      diabetesType: "",
      diabetesControl: "",
      hasStroke: false,
      strokeDate: "",
      strokeResidual: "",
      hasHeartAttack: false,
      heartAttackDate: "",
      heartAttackInterventions: "",
      familyHistory: [],
      pastHistory: [],
      allergies: [],
      smokingStatus: "",
      smokingQuantity: "",
      alcoholUse: "",
      physicalActivity: "",
      sleepPattern: "",
      pregnancies: undefined,
      deliveries: undefined,
      reproductiveComplications: "",
      mentalHealth: [],
      immunizations: [],
      status: "draft",
    },
  });

  const symptomsArray = useFieldArray({ control: form.control, name: "symptoms" });
  const medicationsArray = useFieldArray({ control: form.control, name: "medications" });
  const familyHistoryArray = useFieldArray({ control: form.control, name: "familyHistory" });
  const pastHistoryArray = useFieldArray({ control: form.control, name: "pastHistory" });
  const allergiesArray = useFieldArray({ control: form.control, name: "allergies" });
  const mentalHealthArray = useFieldArray({ control: form.control, name: "mentalHealth" });
  const immunizationsArray = useFieldArray({ control: form.control, name: "immunizations" });

  useEffect(() => {
    if (!patientId) return;
    async function loadData() {
      try {
        const patientData = await apiClient.get<Patient & { medicalHistories: MedicalHistory[] }>(
          `/patients/${patientId}`
        );
        setPatient(patientData);
        const historiesData = await apiClient.get<{ histories: MedicalHistory[] }>(
          `/patients/${patientId}/history`
        );
        if (historiesData.histories.length > 0) {
          const latest = historiesData.histories[0];
          setHistoryId(latest.id);
          const d = latest as unknown as MedicalHistoryFormData;
          form.reset({
            chiefComplaint: d.chiefComplaint || "",
            symptoms: (d.symptoms as any[]) || [],
            medications: (d.medications as any[]) || [],
            hasWound: d.hasWound || false,
            woundLocation: d.woundLocation || "",
            woundType: d.woundType || "",
            woundTimeSinceInjury: d.woundTimeSinceInjury || "",
            woundCause: d.woundCause || "",
            hasDiabetes: d.hasDiabetes || false,
            diabetesDuration: d.diabetesDuration || "",
            diabetesType: d.diabetesType || "",
            diabetesControl: d.diabetesControl || "",
            hasStroke: d.hasStroke || false,
            strokeDate: d.strokeDate || "",
            strokeResidual: d.strokeResidual || "",
            hasHeartAttack: d.hasHeartAttack || false,
            heartAttackDate: d.heartAttackDate || "",
            heartAttackInterventions: d.heartAttackInterventions || "",
            familyHistory: (d.familyHistory as any[]) || [],
            pastHistory: (d.pastHistory as any[]) || [],
            allergies: (d.allergies as any[]) || [],
            smokingStatus: d.smokingStatus || "",
            smokingQuantity: d.smokingQuantity || "",
            alcoholUse: d.alcoholUse || "",
            physicalActivity: d.physicalActivity || "",
            sleepPattern: d.sleepPattern || "",
            pregnancies: d.pregnancies ?? undefined,
            deliveries: d.deliveries ?? undefined,
            reproductiveComplications: d.reproductiveComplications || "",
            mentalHealth: (d.mentalHealth as any[]) || [],
            immunizations: (d.immunizations as any[]) || [],
            status: (d.status as "draft" | "complete") || "draft",
          });
        }
      } catch (err: any) {
        setError(err.message || "Failed to load patient data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [patientId, form]);

  async function onSubmit(status: "draft" | "complete") {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const values = { ...form.getValues(), status };
      const result = await apiClient.post<{ id: string }>(
        `/patients/${patientId}/history`,
        values
      );
      setHistoryId(result.id);
      setSuccess(status === "complete" ? "History marked as complete." : "Draft saved successfully.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save history");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-sm text-muted-foreground">Loading patient data...</p></div>;
  }
  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Patient not found.</p>
        <Button variant="outline" onClick={() => router.push("/patients")}>Back to Patients</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 space-y-4 pr-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Medical History</h1>
            <p className="text-sm text-muted-foreground">
              {patient.lastName}, {patient.firstName} — <span className="font-mono">{patient.caseNumber}</span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push(`/patients/${patientId}`)}>
            Patient Detail
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />{error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4 shrink-0" />{success}
          </div>
        )}

        <Form {...form}>
          <form className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="overflow-x-auto">
                <TabsList className="flex w-max gap-1">
                  {TAB_SECTIONS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" />{tab.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              {/* A. Chief Complaint */}
              <TabsContent value="complaint">
                <CollapsibleSection title="A. Chief Complaint" icon={Activity} defaultOpen>
                  <FormField control={form.control} name="chiefComplaint" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chief Complaint</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Patient's primary reason for visit..." className="min-h-24" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CollapsibleSection>
              </TabsContent>

              {/* B. Symptoms */}
              <TabsContent value="symptoms">
                <CollapsibleSection title="B. Symptoms" icon={AlertCircle} defaultOpen
                  action={<Button type="button" variant="secondary" size="sm" className="gap-1" onClick={() => symptomsArray.append({ name: "", onset: "", worseningTime: "", reliefTime: "", character: "", severity: 0, duration: "", notes: "" })}><Plus className="h-3 w-3" />Add Symptom</Button>}>
                  <div className="space-y-4">
                    {symptomsArray.fields.length === 0 && <p className="text-sm text-muted-foreground">No symptoms added yet.</p>}
                    {symptomsArray.fields.map((field, index) => (
                      <SymptomCard key={field.id} index={index} form={form.control} onRemove={() => symptomsArray.remove(index)} />
                    ))}
                  </div>
                </CollapsibleSection>
              </TabsContent>

              {/* C. Medications */}
              <TabsContent value="medications">
                <CollapsibleSection title="C. Medications" icon={Pill} defaultOpen
                  action={<Button type="button" variant="secondary" size="sm" className="gap-1" onClick={() => medicationsArray.append({ name: "", dose: "", frequency: "", duration: "", status: "current" })}><Plus className="h-3 w-3" />Add Medication</Button>}>
                  <div className="space-y-4">
                    {medicationsArray.fields.length === 0 && <p className="text-sm text-muted-foreground">No medications added yet.</p>}
                    {medicationsArray.fields.map((field, index) => (
                      <MedicationCard key={field.id} index={index} form={form.control} onRemove={() => medicationsArray.remove(index)} />
                    ))}
                  </div>
                </CollapsibleSection>
              </TabsContent>

              {/* D. Wound/Injury */}
              <TabsContent value="wound">
                <CollapsibleSection title="D. Wound/Injury" icon={Bandage} defaultOpen>
                  <FormField control={form.control} name="hasWound" render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl><input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} className="h-4 w-4 rounded border-border" /></FormControl>
                      <FormLabel className="!mt-0">Patient has a wound or injury</FormLabel>
                    </FormItem>
                  )} />
                  {form.watch("hasWound") && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <FormField control={form.control} name="woundLocation" render={({ field }) => (<FormItem><FormLabel>Location</FormLabel><FormControl><Input placeholder="e.g., Left arm" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="woundType" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><FormControl><Input placeholder="e.g., Laceration" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="woundTimeSinceInjury" render={({ field }) => (<FormItem><FormLabel>Time Since Injury</FormLabel><FormControl><Input placeholder="e.g., 2 days" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="woundCause" render={({ field }) => (<FormItem><FormLabel>Cause</FormLabel><FormControl><Input placeholder="e.g., Fall" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                  )}
                </CollapsibleSection>
              </TabsContent>

              {/* E. Chronic Conditions */}
              <TabsContent value="chronic">
                <CollapsibleSection title="E. Chronic Conditions" icon={HeartPulse} defaultOpen>
                  <div className="space-y-6">
                    <ChronicConditionCard form={form.control} condition="diabetes" label="Diabetes" />
                    <ChronicConditionCard form={form.control} condition="stroke" label="Stroke" />
                    <ChronicConditionCard form={form.control} condition="heartAttack" label="Heart Attack" />
                  </div>
                </CollapsibleSection>
              </TabsContent>

              {/* F. Family History */}
              <TabsContent value="family">
                <CollapsibleSection title="F. Family History" icon={Users} defaultOpen
                  action={<Button type="button" variant="secondary" size="sm" className="gap-1" onClick={() => familyHistoryArray.append({ condition: "", relationship: "", ageAtOnset: "" })}><Plus className="h-3 w-3" />Add</Button>}>
                  <DynamicList fields={familyHistoryArray.fields} onRemove={familyHistoryArray.remove} label="Entry" testIdPrefix="family" render={(index) => (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <FormField control={form.control} name={`familyHistory.${index}.condition`} render={({ field }) => (<FormItem><FormLabel>Condition</FormLabel><FormControl><Input placeholder="e.g., Hypertension" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`familyHistory.${index}.relationship`} render={({ field }) => (<FormItem><FormLabel>Relationship</FormLabel><FormControl><Input placeholder="e.g., Father" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`familyHistory.${index}.ageAtOnset`} render={({ field }) => (<FormItem><FormLabel>Age at Onset</FormLabel><FormControl><Input placeholder="e.g., 55" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                  )} />
                </CollapsibleSection>
              </TabsContent>

              {/* G. Past History */}
              <TabsContent value="past">
                <CollapsibleSection title="G. Past History" icon={History} defaultOpen
                  action={<Button type="button" variant="secondary" size="sm" className="gap-1" onClick={() => pastHistoryArray.append({ diagnosis: "", date: "", outcome: "" })}><Plus className="h-3 w-3" />Add</Button>}>
                  <DynamicList fields={pastHistoryArray.fields} onRemove={pastHistoryArray.remove} label="Entry" testIdPrefix="past" render={(index) => (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <FormField control={form.control} name={`pastHistory.${index}.diagnosis`} render={({ field }) => (<FormItem><FormLabel>Diagnosis/Surgery</FormLabel><FormControl><Input placeholder="e.g., Appendectomy" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`pastHistory.${index}.date`} render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`pastHistory.${index}.outcome`} render={({ field }) => (<FormItem><FormLabel>Outcome</FormLabel><FormControl><Input placeholder="e.g., Full recovery" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                  )} />
                </CollapsibleSection>
              </TabsContent>

              {/* H. Allergies */}
              <TabsContent value="allergies">
                <CollapsibleSection title="H. Allergies" icon={AlertCircle} defaultOpen
                  action={<Button type="button" variant="secondary" size="sm" className="gap-1" onClick={() => allergiesArray.append({ type: "", allergen: "", reactionType: "", severity: "mild" })}><Plus className="h-3 w-3" />Add</Button>}>
                  <DynamicList fields={allergiesArray.fields} onRemove={allergiesArray.remove} label="Allergy" testIdPrefix="allergy" render={(index) => (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <FormField control={form.control} name={`allergies.${index}.type`} render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><FormControl><Input placeholder="e.g., Drug" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`allergies.${index}.allergen`} render={({ field }) => (<FormItem><FormLabel>Allergen</FormLabel><FormControl><Input placeholder="e.g., Penicillin" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`allergies.${index}.reactionType`} render={({ field }) => (<FormItem><FormLabel>Reaction Type</FormLabel><FormControl><Input placeholder="e.g., Rash" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`allergies.${index}.severity`} render={({ field }) => (<FormItem><FormLabel>Severity</FormLabel><Select onValueChange={field.onChange} value={field.value || ""}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent><SelectItem value="mild">Mild</SelectItem><SelectItem value="moderate">Moderate</SelectItem><SelectItem value="severe">Severe</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    </div>
                  )} />
                </CollapsibleSection>
              </TabsContent>

              {/* I. Lifestyle */}
              <TabsContent value="lifestyle">
                <CollapsibleSection title="I. Lifestyle" icon={Pill} defaultOpen>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField control={form.control} name="smokingStatus" render={({ field }) => (<FormItem><FormLabel>Smoking Status</FormLabel><Select onValueChange={field.onChange} value={field.value || ""}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent><SelectItem value="never">Never</SelectItem><SelectItem value="former">Former</SelectItem><SelectItem value="current">Current</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="smokingQuantity" render={({ field }) => (<FormItem><FormLabel>Smoking Quantity</FormLabel><FormControl><Input placeholder="e.g., 10/day" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="alcoholUse" render={({ field }) => (<FormItem><FormLabel>Alcohol Use</FormLabel><Select onValueChange={field.onChange} value={field.value || ""}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="occasional">Occasional</SelectItem><SelectItem value="moderate">Moderate</SelectItem><SelectItem value="heavy">Heavy</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="physicalActivity" render={({ field }) => (<FormItem><FormLabel>Physical Activity</FormLabel><Select onValueChange={field.onChange} value={field.value || ""}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent><SelectItem value="sedentary">Sedentary</SelectItem><SelectItem value="light">Light</SelectItem><SelectItem value="moderate">Moderate</SelectItem><SelectItem value="active">Active</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="sleepPattern" render={({ field }) => (<FormItem><FormLabel>Sleep Pattern</FormLabel><FormControl><Input placeholder="e.g., 7 hours/night" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                </CollapsibleSection>
              </TabsContent>

              {/* J. Reproductive History */}
              <TabsContent value="reproductive">
                <CollapsibleSection title="J. Reproductive History" icon={Baby} defaultOpen>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField control={form.control} name="pregnancies" render={({ field }) => (<FormItem><FormLabel>Pregnancies</FormLabel><FormControl><Input type="number" min="0" placeholder="0" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="deliveries" render={({ field }) => (<FormItem><FormLabel>Deliveries</FormLabel><FormControl><Input type="number" min="0" placeholder="0" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="reproductiveComplications" render={({ field }) => (<FormItem className="sm:col-span-3"><FormLabel>Complications</FormLabel><FormControl><Textarea placeholder="Any reproductive complications..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                </CollapsibleSection>
              </TabsContent>

              {/* K. Mental Health */}
              <TabsContent value="mental">
                <CollapsibleSection title="K. Mental Health" icon={Brain} defaultOpen
                  action={<Button type="button" variant="secondary" size="sm" className="gap-1" onClick={() => mentalHealthArray.append({ condition: "", duration: "", treatment: "" })}><Plus className="h-3 w-3" />Add</Button>}>
                  <DynamicList fields={mentalHealthArray.fields} onRemove={mentalHealthArray.remove} label="Entry" testIdPrefix="mental" render={(index) => (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <FormField control={form.control} name={`mentalHealth.${index}.condition`} render={({ field }) => (<FormItem><FormLabel>Condition</FormLabel><FormControl><Input placeholder="e.g., Anxiety" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`mentalHealth.${index}.duration`} render={({ field }) => (<FormItem><FormLabel>Duration</FormLabel><FormControl><Input placeholder="e.g., 2 years" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`mentalHealth.${index}.treatment`} render={({ field }) => (<FormItem><FormLabel>Treatment</FormLabel><FormControl><Input placeholder="e.g., CBT" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                  )} />
                </CollapsibleSection>
              </TabsContent>

              {/* L. Immunizations */}
              <TabsContent value="immunizations">
                <CollapsibleSection title="L. Immunizations" icon={Syringe} defaultOpen
                  action={<Button type="button" variant="secondary" size="sm" className="gap-1" onClick={() => immunizationsArray.append({ vaccine: "", date: "", status: "completed" })}><Plus className="h-3 w-3" />Add</Button>}>
                  <DynamicList fields={immunizationsArray.fields} onRemove={immunizationsArray.remove} label="Entry" testIdPrefix="immunization" render={(index) => (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <FormField control={form.control} name={`immunizations.${index}.vaccine`} render={({ field }) => (<FormItem><FormLabel>Vaccine</FormLabel><FormControl><Input placeholder="e.g., Influenza" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`immunizations.${index}.date`} render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`immunizations.${index}.status`} render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value || ""}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent><SelectItem value="completed">Completed</SelectItem><SelectItem value="scheduled">Scheduled</SelectItem><SelectItem value="refused">Refused</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    </div>
                  )} />
                </CollapsibleSection>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => onSubmit("draft")} disabled={submitting} className="gap-1.5">
                <Save className="h-4 w-4" />{submitting ? "Saving..." : "Save Draft"}
              </Button>
              <Button type="button" onClick={() => onSubmit("complete")} disabled={submitting} className="gap-1.5">
                <CheckCircle2 className="h-4 w-4" />{submitting ? "Saving..." : "Mark as Complete"}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      <div className="hidden w-80 shrink-0 lg:block">
        <AIAssistantPanel
          patientId={patientId}
          historyId={historyId || undefined}
          chiefComplaint={form.watch("chiefComplaint") || undefined}
          symptoms={form.watch("symptoms") as any}
        />
      </div>
    </div>
  );
}

// ── Collapsible Section ──────────────────────────────────

function CollapsibleSection({
  title, icon: Icon, defaultOpen = false, action, children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="pb-0">
          <CollapsibleTrigger className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-left">{title}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {action}
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-4">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ── Dynamic List Item Wrapper ───────────────────────────

function DynamicList({
  fields, onRemove, label, testIdPrefix, render,
}: {
  fields: { id: string }[];
  onRemove: (index: number) => void;
  label: string;
  testIdPrefix: string;
  render: (index: number) => React.ReactNode;
}) {
  if (fields.length === 0) {
    return <p className="text-sm text-muted-foreground">No entries added yet.</p>;
  }
  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div key={field.id} className="rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{label} {index + 1}</span>
            <Button type="button" variant="ghost" size="icon-xs" onClick={() => onRemove(index)} data-testid={`button-remove-${testIdPrefix}-${index}`}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          {render(index)}
        </div>
      ))}
    </div>
  );
}

// ── Chronic Condition Card ──────────────────────────────

function ChronicConditionCard({
  form, condition, label,
}: {
  form: Control<MedicalHistoryFormData>;
  condition: "diabetes" | "stroke" | "heartAttack";
  label: string;
}) {
  const hasField = `has${condition.charAt(0).toUpperCase() + condition.slice(1)}` as keyof MedicalHistoryFormData;
  const hasValue = useWatch({ control: form, name: hasField as any });
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <FormField control={form} name={hasField as any} render={({ field }) => (
        <FormItem className="flex items-center gap-3">
          <FormControl><input type="checkbox" checked={field.value as boolean} onChange={(e) => field.onChange(e.target.checked)} className="h-4 w-4 rounded border-border" /></FormControl>
          <FormLabel className="!mt-0">{label}</FormLabel>
        </FormItem>
      )} />
      {hasValue && (
        <div className="grid gap-4 sm:grid-cols-2">
          {condition === "diabetes" ? (
            <>
              <FormField control={form} name="diabetesDuration" render={({ field }) => (<FormItem><FormLabel>Duration</FormLabel><FormControl><Input placeholder="e.g., 5 years" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form} name="diabetesType" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} value={field.value || ""}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent><SelectItem value="type1">Type 1</SelectItem><SelectItem value="type2">Type 2</SelectItem><SelectItem value="gestational">Gestational</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form} name="diabetesControl" render={({ field }) => (<FormItem><FormLabel>Control</FormLabel><Select onValueChange={field.onChange} value={field.value || ""}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent><SelectItem value="good">Good</SelectItem><SelectItem value="fair">Fair</SelectItem><SelectItem value="poor">Poor</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            </>
          ) : condition === "stroke" ? (
            <>
              <FormField control={form} name="strokeDate" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form} name="strokeResidual" render={({ field }) => (<FormItem><FormLabel>Residual Effects</FormLabel><FormControl><Input placeholder="e.g., Left arm weakness" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </>
          ) : (
            <>
              <FormField control={form} name="heartAttackDate" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form} name="heartAttackInterventions" render={({ field }) => (<FormItem><FormLabel>Interventions</FormLabel><FormControl><Input placeholder="e.g., Stent placement" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
