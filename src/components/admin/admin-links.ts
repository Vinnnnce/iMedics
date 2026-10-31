import {
  Activity, BadgeDollarSign, CreditCard, FileBarChart, GitCompareArrows, LayoutDashboard,
  Flag, Megaphone, Newspaper, RotateCcw, ShieldCheck, Stethoscope, Users, type LucideIcon,
} from "lucide-react";

export interface AdminLink {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match only the exact path (the overview) instead of the whole subtree. */
  exact?: boolean;
  /** Shows the pending-verifications count. */
  badge?: boolean;
}

/**
 * The single source of truth for admin navigation: the in-page admin sidebar
 * and the app-wide navigation both render from it, so an admin only ever sees
 * administration links.
 */
export const ADMIN_LINKS: AdminLink[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/verifications", label: "Verifications", icon: ShieldCheck, badge: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/providers", label: "Providers", icon: Stethoscope },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/refunds", label: "Refunds", icon: RotateCcw },
  { href: "/admin/reconciliation", label: "Reconciliation", icon: GitCompareArrows },
  { href: "/admin/commission", label: "Commission", icon: BadgeDollarSign },
  { href: "/admin/reports", label: "Reports", icon: FileBarChart },
  { href: "/admin/activity", label: "Activity log", icon: Activity },
  { href: "/admin/profile-reports", label: "Profile reports", icon: Flag },
  { href: "/admin/content", label: "Notices & ads", icon: Megaphone },
  { href: "/admin/news", label: "News & podcasts", icon: Newspaper },
];
