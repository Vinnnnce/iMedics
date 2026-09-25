"use client";

import { type Control } from "react-hook-form";
import {
  FormField,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
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
import { Trash2 } from "lucide-react";
import type { MedicalHistoryFormData } from "@/lib/validations";

export function SymptomCard({
  index,
  form,
  onRemove,
}: {
  index: number;
  form: Control<MedicalHistoryFormData>;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Symptom {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          data-testid={`button-remove-symptom-${index}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FormField control={form} name={`symptoms.${index}.name`} render={({ field }) => (
          <FormItem><FormLabel>Symptom Name</FormLabel><FormControl><Input placeholder="e.g., Headache" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form} name={`symptoms.${index}.onset`} render={({ field }) => (
          <FormItem><FormLabel>Onset</FormLabel><FormControl><Input placeholder="e.g., 2 days ago" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form} name={`symptoms.${index}.severity`} render={({ field }) => (
          <FormItem><FormLabel>Severity (0-10)</FormLabel><FormControl><Input type="number" min="0" max="10" value={field.value ?? 0} onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 0)} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form} name={`symptoms.${index}.worseningTime`} render={({ field }) => (
          <FormItem><FormLabel>Worsening</FormLabel><FormControl><Input placeholder="e.g., At night" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form} name={`symptoms.${index}.reliefTime`} render={({ field }) => (
          <FormItem><FormLabel>Relief</FormLabel><FormControl><Input placeholder="e.g., After rest" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form} name={`symptoms.${index}.character`} render={({ field }) => (
          <FormItem><FormLabel>Character</FormLabel><FormControl><Input placeholder="e.g., Throbbing" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form} name={`symptoms.${index}.duration`} render={({ field }) => (
          <FormItem><FormLabel>Duration</FormLabel><FormControl><Input placeholder="e.g., 3 hours" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form} name={`symptoms.${index}.notes`} render={({ field }) => (
          <FormItem className="sm:col-span-2"><FormLabel>Notes</FormLabel><FormControl><Input placeholder="Additional notes..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />
      </div>
    </div>
  );
}

export function MedicationCard({
  index,
  form,
  onRemove,
}: {
  index: number;
  form: Control<MedicalHistoryFormData>;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Medication {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          data-testid={`button-remove-medication-${index}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField control={form} name={`medications.${index}.name`} render={({ field }) => (
          <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="e.g., Aspirin" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form} name={`medications.${index}.dose`} render={({ field }) => (
          <FormItem><FormLabel>Dose</FormLabel><FormControl><Input placeholder="e.g., 100mg" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form} name={`medications.${index}.frequency`} render={({ field }) => (
          <FormItem><FormLabel>Frequency</FormLabel><FormControl><Input placeholder="e.g., Once daily" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form} name={`medications.${index}.duration`} render={({ field }) => (
          <FormItem><FormLabel>Duration</FormLabel><FormControl><Input placeholder="e.g., 3 months" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form} name={`medications.${index}.status`} render={({ field }) => (
          <FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value || "current"}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="current">Current</SelectItem><SelectItem value="recent">Recent</SelectItem></SelectContent></Select><FormMessage /></FormItem>
        )} />
      </div>
    </div>
  );
}
