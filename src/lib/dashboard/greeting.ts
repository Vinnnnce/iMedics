/**
 * Time-of-day greeting in the platform's clinic timezone (Africa/Lagos, WAT).
 * Pure function so it can be unit-tested without a server environment.
 */
export function greetingFor(date: Date = new Date()): "Good morning" | "Good afternoon" | "Good evening" {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Lagos" }).format(date)
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}