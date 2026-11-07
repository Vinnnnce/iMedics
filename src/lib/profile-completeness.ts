/**
 * Profile completeness for doctors and facilities. A complete public profile
 * converts better (patients choose providers they can judge), so the dashboard
 * shows what is still missing and where to fix it. Pure functions: callers
 * load the data.
 */
export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  href: string;
}

export interface Completeness {
  percent: number;
  items: ChecklistItem[];
  missing: ChecklistItem[];
}

const filled = (value: string | null | undefined, min = 1) => (value?.trim().length ?? 0) >= min;

function summarize(items: ChecklistItem[]): Completeness {
  const done = items.filter((i) => i.done).length;
  return {
    percent: Math.round((done / items.length) * 100),
    items,
    missing: items.filter((i) => !i.done),
  };
}

export interface DoctorCompletenessInput {
  avatarUrl: string | null;
  specialty: string | null;
  biography: string | null;
  education: string | null;
  languages: string[];
  location: string | null;
  consultationFee: unknown | null;
  scheduleCount: number;
  portfolioCount: number;
}

export function doctorCompleteness(d: DoctorCompletenessInput): Completeness {
  return summarize([
    { key: "photo", label: "Add a profile photo", done: filled(d.avatarUrl), href: "/doctor/profile" },
    { key: "specialty", label: "Set your specialty", done: filled(d.specialty), href: "/doctor/profile" },
    { key: "bio", label: "Write a short biography (40+ characters)", done: filled(d.biography, 40), href: "/doctor/profile" },
    { key: "education", label: "Add your education", done: filled(d.education), href: "/doctor/profile" },
    { key: "languages", label: "List the languages you speak", done: d.languages.length > 0, href: "/doctor/profile" },
    { key: "location", label: "Add your location", done: filled(d.location), href: "/doctor/profile" },
    { key: "fee", label: "Set your consultation fee", done: d.consultationFee !== null && d.consultationFee !== undefined, href: "/doctor/fees" },
    { key: "schedule", label: "Set your weekly availability", done: d.scheduleCount > 0, href: "/doctor/schedule" },
    { key: "portfolio", label: "Add a portfolio item", done: d.portfolioCount > 0, href: "/doctor/portfolio" },
  ]);
}

export interface FacilityCompletenessInput {
  logoUrl: string | null;
  about: string | null;
  operatingHours: string | null;
  addressLine: string | null;
  city: string | null;
  serviceCount: number;
  isPublished: boolean;
}

export function facilityCompleteness(f: FacilityCompletenessInput): Completeness {
  return summarize([
    { key: "logo", label: "Upload your logo", done: filled(f.logoUrl), href: "/lab/me" },
    { key: "about", label: "Write a short description (40+ characters)", done: filled(f.about, 40), href: "/lab/me" },
    { key: "hours", label: "Add your operating hours", done: filled(f.operatingHours), href: "/lab/me" },
    { key: "address", label: "Add your address and city", done: filled(f.addressLine) && filled(f.city), href: "/lab/me" },
    { key: "services", label: "List at least one priced service", done: f.serviceCount > 0, href: "/lab/services" },
    { key: "published", label: "Publish your public page", done: f.isPublished, href: "/lab/website" },
  ]);
}
