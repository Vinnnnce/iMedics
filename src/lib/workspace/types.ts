/** Additive dashboard contracts. Existing Prisma clinical models remain authoritative. */
export type WorkspaceRole = "PATIENT" | "DOCTOR" | "LAB_SCIENTIST" | "ADMIN";
export type Tone = "green" | "amber" | "red" | "blue" | "neutral";
export interface Metric { label: string; value: string; detail: string; tone?: Tone }
export interface WorkspaceItem {
  id: string; title: string; subtitle: string; status: string;
  at?: string; href?: string; tone?: Tone; caseNumber?: string; toast?: boolean;
}
export interface CareTask extends WorkspaceItem { completed: boolean; kind: string }
export interface TrendPoint { date: string; value: number }
export interface Trend { code: string; name: string; unit: string; points: TrendPoint[] }
export interface WorkspaceData {
  role: WorkspaceRole; name: string; facilityName?: string; caseNumber?: string;
  updatedAt: string; demo?: boolean; metrics: Metric[];
  appointments: WorkspaceItem[]; results: WorkspaceItem[]; messages: WorkspaceItem[];
  timeline: WorkspaceItem[]; notifications: WorkspaceItem[]; tasks: CareTask[];
  payments: WorkspaceItem[]; operations: WorkspaceItem[]; trends: Trend[];
  alerts: WorkspaceItem[]; insights: WorkspaceItem[];
  subscription: string; availability: string; extensionsReady: boolean; unreadMessages: number;
}
export interface WorkspaceDocument {
  id: string; file_name: string; mime_type: string; size_bytes: number;
  created_at: string; confirmed_at: string | null;
}
export interface WorkspaceShare {
  id: string; document_id: string; recipient_name: string;
  expires_at: string; revoked_at: string | null;
}
