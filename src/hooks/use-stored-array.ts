"use client";

import { useEffect, useState } from "react";

/**
 * A JSON string-array value persisted in localStorage. The read is deferred to a
 * microtask so the first server-rendered frame always matches (no hydration
 * mismatch) and effects stay free of synchronous setState calls.
 */
export function useStoredArray(key: string) {
  const [value, setValue] = useState<string[]>([]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const raw = window.localStorage.getItem(key);
        const parsed: unknown = JSON.parse(raw ?? "[]");
        setValue(Array.isArray(parsed) ? (parsed as string[]) : []);
      } catch {
        setValue([]);
      }
    });
  }, [key]);

  return [value, setValue] as const;
}
