import { z } from "zod";
import type { WorkspaceItem } from "./types";
export const dashboardFilterSchema = z.object({
  search: z.string().trim().max(100).default(""), status: z.string().max(60).default("all"),
  from: z.iso.date().or(z.literal("")).default(""), to: z.iso.date().or(z.literal("")).default(""),
}).refine(value => !value.from || !value.to || value.from <= value.to, "From date must not follow to date");
export function filterWorkspaceItems(items: readonly WorkspaceItem[], filters: { search: string; status: string; from: string; to: string }) {
  return items.filter(item => {
    const date = item.at?.slice(0, 10) ?? "";
    return `${item.title} ${item.subtitle} ${item.caseNumber ?? ""}`.toLowerCase().includes(filters.search.toLowerCase())
      && (filters.status === "all" || item.status === filters.status)
      && (!filters.from || date >= filters.from) && (!filters.to || Boolean(date && date <= filters.to));
  });
}
