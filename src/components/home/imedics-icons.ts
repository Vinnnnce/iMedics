import {
  Activity, Calendar, ChartColumn, ClipboardList, FileText, FlaskConical, FolderOpen, HeartPulse, MessageCircle, Pill, Scan,
  Share2, ShieldCheck, Sparkles, Stethoscope, Users, type LucideIcon,
} from "lucide-react";
import type { ImedicsIcon } from "@/lib/home/imedics-home-content";

/** One icon per `ImedicsIcon` key; typed as a full Record so adding a key to the content type fails the build until it is mapped here. */
export const IMEDICS_ICONS: Record<ImedicsIcon, LucideIcon> = {
  stethoscope: Stethoscope,
  "message-circle": MessageCircle,
  calendar: Calendar,
  flask: FlaskConical,
  folder: FolderOpen,
  "file-text": FileText,
  "heart-pulse": HeartPulse,
  sparkles: Sparkles,
  activity: Activity,
  "clipboard-list": ClipboardList,
  "shield-check": ShieldCheck,
  pill: Pill,
  scan: Scan,
  users: Users,
  "bar-chart": ChartColumn,
  "share-2": Share2,
};
