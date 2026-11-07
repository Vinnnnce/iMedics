"use client";

/** JSON fetch helper for HIS client components; throws the server's safe error message. */
export async function api<T = Record<string, unknown>>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { issues?: { message: string }[]; error?: string }).issues?.[0]?.message ?? (data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const inputClass = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm";
export const textareaClass = "w-full rounded-lg border border-input bg-background p-2 text-sm";
