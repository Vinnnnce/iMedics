// Dates are always shown in clinic time (Nigeria, WAT) so server and client render identically.
const TIME_ZONE = "Africa/Lagos";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export function formatClinicDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, dateStyle: "medium" }).format(new Date(value));
}

export function ageFromDob(dob: Date | string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
