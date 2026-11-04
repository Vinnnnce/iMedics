export const COOKIE_CONSENT_KEY = "medic1905.consent.v1";
export const COOKIE_CONSENT_EVENT = "medic1905:consent";
export type CookieConsent = { version: 1; essential: true; preferences: boolean; analytics: boolean; performance: boolean; marketing: boolean; savedAt: string };
export const OPTIONAL_CATEGORIES = ["preferences", "analytics", "performance", "marketing"] as const;
export function readCookieConsent(): CookieConsent | null {
  try {
    const value = JSON.parse(localStorage.getItem(COOKIE_CONSENT_KEY) ?? "null");
    if (!value || value.version !== 1 || value.essential !== true || !OPTIONAL_CATEGORIES.every(key => typeof value[key] === "boolean")) return null;
    const age = Date.now() - Date.parse(value.savedAt);
    if (!Number.isFinite(age) || age < -60000 || age > 180 * 86400000) return null;
    return value;
  } catch { return null; }
}
export function optionalProcessingAllowed(category: typeof OPTIONAL_CATEGORIES[number]) {
  return readCookieConsent()?.[category] === true;
}
export function saveCookieConsent(consent: CookieConsent) {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
    if (!consent.preferences) {
      localStorage.removeItem("imedics.theme");
      localStorage.removeItem("medic1905.sidebar.collapsed");
      document.cookie = "sidebar_state=; path=/; max-age=0; SameSite=Lax";
    }
  } catch { /* Private browsing: memory-only consent is safe; deny optional processing on reload. */ }
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: consent }));
}
