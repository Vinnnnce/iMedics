"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";

export type ThemePreference = "dark" | "light" | "system";
type EffectiveTheme = "dark" | "light";

const THEME_STORAGE_KEY = "imedics.theme";
const THEME_CHANGE_EVENT = "imedics:theme-change";

/** The stored preference ("system" follows the OS colour scheme). */
function storedPreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "dark" || value === "light" || value === "system" ? value : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** The class currently applied to <html> is the single source of truth. */
function getSnapshot(): EffectiveTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): EffectiveTheme {
  return "dark";
}

function subscribe(callback: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, callback);
}

interface ThemeContextType {
  /** The theme currently applied. */
  theme: EffectiveTheme;
  /** The saved preference — "system" follows the OS colour scheme. */
  preference: ThemePreference;
  /** Toggle between light and dark (keeps an explicit preference). */
  toggleTheme: () => void;
  /** Set an explicit preference, including "system". */
  setThemePreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * The applied theme lives on <html>: the pre-hydration script in the root
 * layout sets it from the stored preference, or the system colour scheme on
 * a first visit, so there is no flash of the wrong theme. React reads that
 * class as an external store (no state to sync on mount). Setting a
 * preference flips the class, persists the choice, and works for every page
 * inside the provider. "system" keeps following the OS colour scheme live.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const apply = useCallback((preference: ThemePreference) => {
    const next: EffectiveTheme =
      preference === "system" ? (systemPrefersDark() ? "dark" : "light") : preference;
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Private browsing or blocked storage: the in-memory choice still works.
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  const preference = useSyncExternalStore(
    subscribe,
    storedPreference,
    () => "system" as ThemePreference,
  );

  // While "system" is selected, follow OS colour-scheme changes live.
  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference, apply]);

  const toggleTheme = () => {
    const next: EffectiveTheme = document.documentElement.classList.contains("dark") ? "light" : "dark";
    apply(next);
  };

  return (
    <ThemeContext.Provider
      value={{ theme, preference, toggleTheme, setThemePreference: apply }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
