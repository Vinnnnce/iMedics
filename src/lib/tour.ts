export type TourLink = { href: string; label: string };
export type TourStep = TourLink & { description: string };
const descriptions: Record<string, string> = {
  "/patient/records": "Access documents shared with you and upload your own medical records. Share only with authorised care professionals.",
  "/patient/appointments": "Find upcoming appointments, review booking details and manage visits.",
  "/patient/results": "Read laboratory results released to you. Ask your clinician about their meaning.",
  "/patient/case-file": "Explore your electronic case file and the records available to your account.",
  "/patient/prescriptions": "Review prescriptions issued by your treating clinicians.",
  "/patient/reminders": "Manage follow-up and medication reminders without changing prescribed treatment.",
  "/doctor/consultations": "Manage consultations and clinical documentation. Review all information before signing.",
  "/doctor/prescriptions": "Create and review prescriptions within your professional authorisation. AI never replaces clinical judgment.",
  "/doctor/patients": "Find your assigned patients and open their authorised case files.",
  "/doctor/lab-requests": "Create and follow laboratory requests for your patients.",
  "/doctor/ai-tools": "Use clinical assistance as a draft aid only. Verify every output before clinical use.",
  "/lab/staff": "Invite staff and assign the minimum necessary permissions. Revoke access when a staff member leaves.",
  "/lab/hospital-settings": "Configure departments and facility workflows. These settings require facility administration permission.",
  "/lab/orders": "Manage authorised laboratory orders, specimen progress and verified results.",
  "/lab/examinations": "Manage diagnostic examinations and verified reports.",
  "/lab/pharmacy": "Review medication orders and dispensing workflows within your pharmacy permissions.",
  "/lab/nursing": "Access nursing tasks and patient information available to your role.",
  "/settings": "Review account, notification and privacy settings. Cookie choices can be changed at any time.",
};
const priorities = Object.keys(descriptions);
/** Receives the very same permission-filtered links the navbar renders, never an invented feature list. */
export function buildTourSteps(links: readonly TourLink[]): TourStep[] {
  return [...links].sort((a, b) => {
    const ai = priorities.indexOf(a.href.split("?")[0]), bi = priorities.indexOf(b.href.split("?")[0]);
    return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi);
  }).map(link => ({ ...link, description: descriptions[link.href.split("?")[0]] ?? `Open ${link.label} from your workspace navigation. Only tools authorised for your account are shown.` }));
}
export const PUBLIC_TOUR: TourStep[] = [
  { href: "/", label: "Welcome to Medic1905", description: "An introduction to connected healthcare. This tour uses no patient information." },
  { href: "/#features", label: "Healthcare services", description: "Explore records, consultations, appointments and healthcare services." },
  { href: "/#for-patients", label: "Patient accounts", description: "Patients can access their available records, results and appointments after registration." },
  { href: "/doctors", label: "Doctor accounts", description: "Independent doctors complete professional verification before using clinical workspaces." },
  { href: "/hospitals", label: "Hospital accounts", description: "Verified facilities manage authorised staff and hospital departments." },
  { href: "/laboratories", label: "Laboratory accounts", description: "Laboratories manage their permitted orders, specimens and results." },
  { href: "/diagnostic-centres", label: "Diagnostic-centre accounts", description: "Diagnostic facilities manage authorised examinations, imaging and reports." },
  { href: "/pharmacies", label: "Pharmacy accounts", description: "Pharmacies use verified accounts and role-restricted medication workflows." },
  { href: "/#features", label: "Healthcare intelligence", description: "AI assistance is informational and may be wrong. It is not a diagnosis or emergency service. Clinical tools require an authorised account." },
  { href: "/auth/signup", label: "Create your account", description: "Create a secure sign-in, choose your account type and complete registration. Your workspace tour starts after registration and any required verification." },
];
