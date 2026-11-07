/**
 * Nursing observation type registry (pure data — safe to import client-side).
 * Each entry fixes the unit so chart entries are unit-annotated and comparable.
 * The pattern is format validation only: no clinical thresholds or automatic
 * interpretation, which stay with the qualified clinician.
 */

export interface ObservationType {
  key: string;
  label: string;
  unit: string;
  /** Format check for the entered value (BP "120/80", pain "6", weight "72.5"). */
  pattern?: RegExp;
}

export const OBSERVATION_TYPES: readonly ObservationType[] = [
  { key: "TEMPERATURE", label: "Temperature", unit: "°C", pattern: /^\d{2}(\.\d)?$/ },
  { key: "PULSE", label: "Pulse", unit: "bpm", pattern: /^\d{2,3}$/ },
  { key: "RESPIRATION", label: "Respiratory rate", unit: "/min", pattern: /^\d{1,2}$/ },
  { key: "SPO2", label: "Oxygen saturation", unit: "%", pattern: /^\d{2,3}$/ },
  { key: "BLOOD_PRESSURE", label: "Blood pressure", unit: "mmHg", pattern: /^\d{2,3}\s*\/\s*\d{2,3}$/ },
  { key: "WEIGHT", label: "Weight", unit: "kg", pattern: /^\d{1,3}(\.\d)?$/ },
  { key: "HEIGHT", label: "Height", unit: "cm", pattern: /^\d{2,3}(\.\d)?$/ },
  { key: "PAIN", label: "Pain score", unit: "0-10", pattern: /^(10|[0-9])$/ },
  { key: "GLUCOSE", label: "Blood glucose", unit: "mg/dL", pattern: /^\d{1,4}(\.\d)?$/ },
  { key: "INTAKE", label: "Fluid intake", unit: "mL", pattern: /^\d{1,5}$/ },
  { key: "OUTPUT", label: "Fluid output", unit: "mL", pattern: /^\d{1,5}$/ },
];

export function observationType(key: string): ObservationType | undefined {
  return OBSERVATION_TYPES.find((t) => t.key === key);
}
