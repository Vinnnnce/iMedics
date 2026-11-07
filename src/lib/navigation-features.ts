/** Presentation availability only. Server role/record guards remain mandatory. */
const hospitalModuleByPath: Record<string, string> = {
  "/lab/emergency": "EMERGENCY", "/lab/admissions": "INPATIENT",
  "/lab/wards": "INPATIENT", "/lab/nursing": "INPATIENT",
  "/lab/nursing-handover": "INPATIENT", "/lab/mar": "INPATIENT",
  "/lab/outpatient": "OUTPATIENT", "/lab/surgery": "SURGERY",
  "/lab/orders": "LABORATORY", "/lab/exams": "IMAGING",
  "/lab/pharmacy": "PHARMACY", "/lab/medication-orders": "PHARMACY",
  "/lab/formulary": "PHARMACY", "/lab/insurance": "INSURANCE",
  "/lab/physiotherapy": "REHABILITATION",
};
export function navigationFeatureEnabled(href: string, kind: string, enabledModules?: readonly string[] | null) {
  if (kind !== "HOSPITAL" || enabledModules == null) return true;
  const feature = hospitalModuleByPath[href.split("?")[0]];
  return !feature || enabledModules.includes(feature);
}
