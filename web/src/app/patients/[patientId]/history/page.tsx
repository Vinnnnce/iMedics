"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { AIAssistantPanel } from "@/components/ai-assistant-panel";
import {
  medicalHistorySchema,
  type MedicalHistoryFormData,
} from "@/lib/validations";
import { apiClient } from "@/lib/api-client";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  ChevronRight,
  Activity,
  AlertTriangle,
  ShieldAlert,
  Heart,
  Brain,
  Baby,
  Pill,
  Wrench,
  Users,
  ClipboardList,
  Wind,
  Calendar,
  FileText,
} from "lucide-react";

interface MedicalHistoryPageProps {
  params: { patientId: string };
}

export default function MedicalHistoryPage({ params }: MedicalHistoryPageProps) {
  const router = useRouter();
  const { patientId } = params;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("chief");

  const form = useForm<MedicalHistoryFormData>({
    resolver: zodResolver(medicalHistorySchema) as any,
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

  // Field arrays for dynamic lists
  const symptomsField = useFieldArray({ control: form.control, name: "symptoms" });
  const medicationsField = useFieldArray({ control: form.control, name: "medications" });
  const familyHistoryField = useFieldArray({ control: form.control, name: "familyHistory" });
  const pastHistoryField = useFieldArray({ control: form.control, name: "pastHistory" });
  const allergiesField = useFieldArray({ control: form.control, name: "allergies" });
  const mentalHealthField = useFieldArray({ control: form.control, name: "mentalHealth" });
  const immunizationsField = useFieldArray({ control: form.control, name: "immunizations" });

  async function onSubmit(data: MedicalHistoryFormData, status: "draft" | "complete") {
    setSubmitting(true);
    setError(null);
    try {
      const payload = { ...data, status };
      const endpoint = historyId
        ? `/patients/${patientId}/history/${historyId}`
        : `/patients/${patientId}/history`;
      const result = historyId
        ? await apiClient.put<{ id: string }>(endpoint, payload)
        : await apiClient.post<{ id: string }>(endpoint, payload);
      if (!historyId && result?.id) {
        setHistoryId(result.id);
      }
      if (status === "complete") {
        router.push(`/patients/${patientId}`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save medical history");
    } finally {
      setSubmitting(false);
    }
  }

  const chiefComplaint = form.watch("chiefComplaint");
  const symptoms = form.watch("symptoms");

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Main Form Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/patients/${patientId}`)}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-bold">Medical History</h1>
                <p className="text-sm text-muted-foreground">
                  Patient ID: {patientId}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={form.handleSubmit((d) => onSubmit(d, "draft"))}
                disabled={submitting}
              >
                <Save className="h-4 w-4" />
                Save Draft
              </Button>
              <Button
                size="sm"
                onClick={form.handleSubmit((d) => onSubmit(d, "complete"))}
                disabled={submitting}
              >
                <CheckCircle2 className="h-4 w-4" />
                Complete
              </Button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Safety Banner */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-xs text-muted-foreground">
              AI assistance is available after saving. All AI outputs are
              non-diagnostic and must be clinician-reviewed.
            </p>
          </div>

          <Form {...form}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-6 lg:grid-cols-12">
                <TabsTrigger value="chief" className="text-xs">Chief</TabsTrigger>
                <TabsTrigger value="symptoms" className="text-xs">Symptoms</TabsTrigger>
                <TabsTrigger value="meds" className="text-xs">Medications</TabsTrigger>
                <TabsTrigger value="wound" className="text-xs">Wound</TabsTrigger>
                <TabsTrigger value="chronic" className="text-xs">Chronic</TabsTrigger>
                <TabsTrigger value="family" className="text-xs">Family</TabsTrigger>
                <TabsTrigger value="past" className="text-xs">Past Hx</TabsTrigger>
                <TabsTrigger value="allergies" className="text-xs">Allergies</TabsTrigger>
                <TabsTrigger value="lifestyle" className="text-xs">Lifestyle</TabsTrigger>
                <TabsTrigger value="repro" className="text-xs">Repro</TabsTrigger>
                <TabsTrigger value="mental" className="text-xs">Mental</TabsTrigger>
                <TabsTrigger value="immun" className="text-xs">Immunize</TabsTrigger>
              </TabsList>

              {/* A. Chief Complaint */}
              <TabsContent value="chief">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileText className="h-5 w-5 text-primary" />
                      Chief Complaint
                    </CardTitle>
                    <CardDescription>
                      The main reason for the patient's visit, in their own words
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="chiefComplaint"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chief Complaint</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="e.g., Patient reports chest pain for the past 3 days..."
                              className="min-h-[100px]"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormDescription>
                            Record the patient's primary complaint in their own words
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* B. Symptoms */}
              <TabsContent value="symptoms">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Activity className="h-5 w-5 text-primary" />
                      Symptoms
                    </CardTitle>
                    <CardDescription>
                      Add one entry per symptom with onset, worsening/relief, character, and severity (0-10)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {symptomsField.fields.map((field, index) => (
                      <div key={field.id} className="rounded-lg border border-border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">Symptom #{index + 1}</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => symptomsField.remove(index)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <FormField
                            control={form.control}
                            name={`symptoms.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Symptom</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Chest pain" {...field} value={field.value ?? ""} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`symptoms.${index}.onset`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Onset</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., 3 days ago" {...field} value={field.value ?? ""} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`symptoms.${index}.worseningTime`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Worsening</FormLabel>
                                <FormControl>
                                  <Input placeholder="What makes it worse?" {...field} value={field.value ?? ""} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`symptoms.${index}.reliefTime`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Relief</FormLabel>
                                <FormControl>
                                  <Input placeholder="What provides relief?" {...field} value={field.value ?? ""} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`symptoms.${index}.character`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Character</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Sharp, dull, throbbing" {...field} value={field.value ?? ""} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`symptoms.${index}.severity`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Severity (0-10)</FormLabel>
                                <FormControl>
                                  <Input type="number" min={0} max={10} {...field}
                                    value={field.value ?? ""}
                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name={`symptoms.${index}.notes`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notes</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Additional notes..." className="min-h-[60px]" {...field} value={field.value ?? ""} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => symptomsField.append({ name: "", onset: "", worseningTime: "", reliefTime: "", character: "", severity: null, duration: "", notes: "" })}
                    >
                      <Plus className="h-4 w-4" />
                      Add Symptom
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* C. Medications */}
              <TabsContent value="meds">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Pill className="h-5 w-5 text-primary" />
                      Current & Recent Medications
                    </CardTitle>
                    <CardDescription>
                      All medications the patient is currently taking or recently stopped
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {medicationsField.fields.map((field, index) => (
                      <div key={field.id} className="rounded-lg border border-border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">Medication #{index + 1}</h4>
                          <Button variant="ghost" size="sm" onClick={() => medicationsField.remove(index)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <FormField
                            control={form.control}
                            name={`medications.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl><Input placeholder="e.g., Metformin" {...field} value={field.value ?? ""} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`medications.${index}.dose`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Dose</FormLabel>
                                <FormControl><Input placeholder="e.g., 500mg" {...field} value={field.value ?? ""} /></FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`medications.${index}.frequency`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Frequency</FormLabel>
                                <FormControl><Input placeholder="e.g., Twice daily" {...field} value={field.value ?? ""} /></FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`medications.${index}.duration`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Duration</FormLabel>
                                <FormControl><Input placeholder="e.g., 3 months" {...field} value={field.value ?? ""} /></FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`medications.${index}.status`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value ?? ""}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="current">Current</SelectItem>
                                    <SelectItem value="recent">Recently Stopped</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => medicationsField.append({ name: "", dose: "", frequency: "", duration: "", status: "current" })}
                    >
                      <Plus className="h-4 w-4" />
                      Add Medication
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* D. Wound / Injury */}
              <TabsContent value="wound">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Wrench className="h-5 w-5 text-primary" />
                      Wound / Injury
                    </CardTitle>
                    <CardDescription>
                      Document any current wound or injury
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="hasWound"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                          <div className="space-y-0.5">
                            <FormLabel>Has Wound/Injury?</FormLabel>
                            <FormDescription>Toggle if patient has a current wound or injury</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {form.watch("hasWound") && (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <FormField control={form.control} name="woundLocation" render={({ field }) => (
                          <FormItem><FormLabel>Location</FormLabel><FormControl><Input placeholder="e.g., Left arm" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="woundType" render={({ field }) => (
                          <FormItem><FormLabel>Type</FormLabel><FormControl><Input placeholder="e.g., Laceration, burn" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="woundTimeSinceInjury" render={({ field }) => (
                          <FormItem><FormLabel>Time Since Injury</FormLabel><FormControl><Input placeholder="e.g., 2 days" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="woundCause" render={({ field }) => (
                          <FormItem><FormLabel>Cause</FormLabel><FormControl><Input placeholder="e.g., Fall, accident" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                        )} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* E. Chronic Conditions */}
              <TabsContent value="chronic">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Heart className="h-5 w-5 text-primary" />
                      Chronic Conditions
                    </CardTitle>
                    <CardDescription>
                      Diabetes, stroke, and heart attack history
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Diabetes */}
                    <div className="space-y-3">
                      <FormField control={form.control} name="hasDiabetes" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                          <div className="space-y-0.5"><FormLabel>Diabetes</FormLabel></div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                      {form.watch("hasDiabetes") && (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 pl-4">
                          <FormField control={form.control} name="diabetesType" render={({ field }) => (
                            <FormItem><FormLabel>Type</FormLabel><FormControl><Input placeholder="Type 1/2" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name="diabetesDuration" render={({ field }) => (
                            <FormItem><FormLabel>Duration</FormLabel><FormControl><Input placeholder="e.g., 5 years" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name="diabetesControl" render={({ field }) => (
                            <FormItem><FormLabel>Control</FormLabel><FormControl><Input placeholder="Well/poorly controlled" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                          )} />
                        </div>
                      )}
                    </div>
                    <Separator />
                    {/* Stroke */}
                    <div className="space-y-3">
                      <FormField control={form.control} name="hasStroke" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                          <div className="space-y-0.5"><FormLabel>Stroke</FormLabel></div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                      {form.watch("hasStroke") && (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 pl-4">
                          <FormField control={form.control} name="strokeDate" render={({ field }) => (
                            <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name="strokeResidual" render={({ field }) => (
                            <FormItem><FormLabel>Residual Effects</FormLabel><FormControl><Input placeholder="e.g., Weakness in right arm" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                          )} />
                        </div>
                      )}
                    </div>
                    <Separator />
                    {/* Heart Attack */}
                    <div className="space-y-3">
                      <FormField control={form.control} name="hasHeartAttack" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                          <div className="space-y-0.5"><FormLabel>Heart Attack</FormLabel></div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                      {form.watch("hasHeartAttack") && (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 pl-4">
                          <FormField control={form.control} name="heartAttackDate" render={({ field }) => (
                            <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name="heartAttackInterventions" render={({ field }) => (
                            <FormItem><FormLabel>Interventions</FormLabel><FormControl><Input placeholder="e.g., Stent placement" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                          )} />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* F. Family History */}
              <TabsContent value="family">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-5 w-5 text-primary" />
                      Family History
                    </CardTitle>
                    <CardDescription>
                      Significant family medical history (parents, siblings, etc.)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {familyHistoryField.fields.map((field, index) => (
                      <div key={field.id} className="rounded-lg border border-border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">Entry #{index + 1}</h4>
                          <Button variant="ghost" size="sm" onClick={() => familyHistoryField.remove(index)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <FormField control={form.control} name={`familyHistory.${index}.condition`} render={({ field }) => (
                            <FormItem><FormLabel>Condition</FormLabel><FormControl><Input placeholder="e.g., Diabetes" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name={`familyHistory.${index}.relationship`} render={({ field }) => (
                            <FormItem><FormLabel>Relationship</FormLabel><FormControl><Input placeholder="e.g., Father" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name={`familyHistory.${index}.ageAtOnset`} render={({ field }) => (
                            <FormItem><FormLabel>Age at Onset</FormLabel><FormControl><Input placeholder="e.g., 55" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                          )} />
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm"
                      onClick={() => familyHistoryField.append({ condition: "", relationship: "", ageAtOnset: "" })}
                    >
                      <Plus className="h-4 w-4" />
                      Add Family History Entry
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* G. Past History */}
              <TabsContent value="past">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ClipboardList className="h-5 w-5 text-primary" />
                      Past Medical History
                    </CardTitle>
                    <CardDescription>
                      Previous diagnoses, surgeries, hospitalizations, or outcomes
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {pastHistoryField.fields.map((field, index) => (
                      <div key={field.id} className="rounded-lg border border-border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">Entry #{index + 1}</h4>
                          <Button variant="ghost" size="sm" onClick={() => pastHistoryField.remove(index)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <FormField control={form.control} name={`pastHistory.${index}.diagnosis`} render={({ field }) => (
                            <FormItem><FormLabel>Diagnosis/Surgery</FormLabel><FormControl><Input placeholder="e.g., Appendectomy" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name={`pastHistory.${index}.date`} render={({ field }) => (
                            <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name={`pastHistory.${index}.outcome`} render={({ field }) => (
                            <FormItem><FormLabel>Outcome</FormLabel><FormControl><Input placeholder="e.g., Full recovery" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                          )} />
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm"
                      onClick={() => pastHistoryField.append({ diagnosis: "", date: "", outcome: "" })}
                    >
                      <Plus className="h-4 w-4" />
                      Add Past History Entry
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* H. Allergies */}
              <TabsContent value="allergies">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Wind className="h-5 w-5 text-primary" />
                      Allergies
                    </CardTitle>
                    <CardDescription>
                      Known allergies (medications, food, environmental, etc.)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {allergiesField.fields.map((field, index) => (
                      <div key={field.id} className="rounded-lg border border-border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">Allergy #{index + 1}</h4>
                          <Button variant="ghost" size="sm" onClick={() => allergiesField.remove(index)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <FormField control={form.control} name={`allergies.${index}.type`} render={({ field }) => (
                            <FormItem><FormLabel>Type</FormLabel><FormControl><Input placeholder="e.g., Medication" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name={`allergies.${index}.allergen`} render={({ field }) => (
                            <FormItem><FormLabel>Allergen</FormLabel><FormControl><Input placeholder="e.g., Penicillin" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name={`allergies.${index}.reactionType`} render={({ field }) => (
                            <FormItem><FormLabel>Reaction Type</FormLabel><FormControl><Input placeholder="e.g., Rash, anaphylaxis" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name={`allergies.${index}.severity`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Severity</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value ?? ""}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select severity" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="mild">Mild</SelectItem>
                                  <SelectItem value="moderate">Moderate</SelectItem>
                                  <SelectItem value="severe">Severe</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm"
                      onClick={() => allergiesField.append({ type: "", allergen: "", reactionType: "", severity: "mild" })}
                    >
                      <Plus className="h-4 w-4" />
                      Add Allergy
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* I. Lifestyle Factors */}
              <TabsContent value="lifestyle">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Activity className="h-5 w-5 text-primary" />
                      Lifestyle Factors
                    </CardTitle>
                    <CardDescription>
                      Smoking, alcohol, physical activity, and sleep patterns
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <FormField control={form.control} name="smokingStatus" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Smoking Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value ?? ""}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="never">Never</SelectItem>
                              <SelectItem value="current">Current</SelectItem>
                              <SelectItem value="former">Former</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="smokingQuantity" render={({ field }) => (
                        <FormItem><FormLabel>Smoking Quantity</FormLabel><FormControl><Input placeholder="e.g., 10/day for 5 years" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="alcoholUse" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alcohol Use</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value ?? ""}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="occasional">Occasional</SelectItem>
                              <SelectItem value="moderate">Moderate</SelectItem>
                              <SelectItem value="heavy">Heavy</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="physicalActivity" render={({ field }) => (
                        <FormItem><FormLabel>Physical Activity</FormLabel><FormControl><Input placeholder="e.g., 3x/week, 30min" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="sleepPattern" render={({ field }) => (
                      <FormItem><FormLabel>Sleep Pattern</FormLabel><FormControl><Input placeholder="e.g., 7-8 hours, no issues" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                    )} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* J. Reproductive History */}
              <TabsContent value="repro">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Baby className="h-5 w-5 text-primary" />
                      Reproductive History
                    </CardTitle>
                    <CardDescription>
                      Pregnancy and delivery history (if applicable)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <FormField control={form.control} name="pregnancies" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Pregnancies</FormLabel>
                          <FormControl><Input type="number" min={0} {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="deliveries" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Deliveries</FormLabel>
                          <FormControl><Input type="number" min={0} {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="reproductiveComplications" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complications</FormLabel>
                        <FormControl><Textarea placeholder="e.g., Gestational diabetes, preeclampsia..." className="min-h-[80px]" {...field} value={field.value ?? ""} /></FormControl>
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* K. Mental Health */}
              <TabsContent value="mental">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Brain className="h-5 w-5 text-primary" />
                      Mental Health
                    </CardTitle>
                    <CardDescription>
                      Mental health history including treatments
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {mentalHealthField.fields.map((field, index) => (
                      <div key={field.id} className="rounded-lg border border-border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">Entry #{index + 1}</h4>
                          <Button variant="ghost" size="sm" onClick={() => mentalHealthField.remove(index)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <FormField control={form.control} name={`mentalHealth.${index}.condition`} render={({ field }) => (
                            <FormItem><FormLabel>Condition</FormLabel><FormControl><Input placeholder="e.g., Depression" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name={`mentalHealth.${index}.duration`} render={({ field }) => (
                            <FormItem><FormLabel>Duration</FormLabel><FormControl><Input placeholder="e.g., 2 years" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name={`mentalHealth.${index}.treatment`} render={({ field }) => (
                            <FormItem><FormLabel>Treatment</FormLabel><FormControl><Input placeholder="e.g., SSRIs, therapy" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                          )} />
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm"
                      onClick={() => mentalHealthField.append({ condition: "", duration: "", treatment: "" })}
                    >
                      <Plus className="h-4 w-4" />
                      Add Mental Health Entry
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* L. Immunizations */}
              <TabsContent value="immun">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calendar className="h-5 w-5 text-primary" />
                      Immunizations
                    </CardTitle>
                    <CardDescription>
                      Vaccination history and status
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {immunizationsField.fields.map((field, index) => (
                      <div key={field.id} className="rounded-lg border border-border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">Immunization #{index + 1}</h4>
                          <Button variant="ghost" size="sm" onClick={() => immunizationsField.remove(index)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <FormField control={form.control} name={`immunizations.${index}.vaccine`} render={({ field }) => (
                            <FormItem><FormLabel>Vaccine</FormLabel><FormControl><Input placeholder="e.g., Influenza" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name={`immunizations.${index}.date`} render={({ field }) => (
                            <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name={`immunizations.${index}.status`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value ?? ""}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="scheduled">Scheduled</SelectItem>
                                  <SelectItem value="refused">Refused</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm"
                      onClick={() => immunizationsField.append({ vaccine: "", date: "", status: "completed" })}
                    >
                      <Plus className="h-4 w-4" />
                      Add Immunization
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </Form>
        </div>
      </div>

      {/* AI Assistant Panel */}
      <div className="w-80 shrink-0">
        <AIAssistantPanel
          patientId={patientId}
          historyId={historyId || undefined}
          chiefComplaint={chiefComplaint ?? ""}
          symptoms={symptoms}
        />
      </div>
    </div>
  );
}
