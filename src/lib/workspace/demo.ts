import type { WorkspaceData, WorkspaceRole, WorkspaceItem } from "./types";

/** Synthetic records are imported ONLY by the separate preview entry point. */
export function demoWorkspace(role: WorkspaceRole = "PATIENT"): WorkspaceData {
  const day = new Date().toISOString().slice(0, 10);
  const at = (time: string) => `${day}T${time}:00+01:00`;
  const clinician = role === "DOCTOR";
  const facility = role === "LAB_SCIENTIST";
  const admin = role === "ADMIN";
  const upcoming: WorkspaceItem[] = [
    { id: "apt-1", title: clinician || facility ? "Amara Okafor" : "Dr. Sarah Adebayo", subtitle: facility ? "Complete blood count" : "General health consultation", status: "Confirmed", at: at("14:30"), tone: "green", caseNumber: "IM-2026-0842" },
    { id: "apt-2", title: clinician || facility ? "Daniel Williams" : "Dr. David Okonkwo", subtitle: facility ? "Lipid profile" : "Cardiology follow-up", status: "Confirmed", at: at("15:15"), tone: "blue", caseNumber: "IM-2026-0901" },
    { id: "apt-3", title: clinician || facility ? "Grace Obi" : "Dr. Ifeoma Eze", subtitle: facility ? "Thyroid function" : "Results review", status: "Booked", at: new Date(Date.now() + 86400000 * 3).toISOString(), tone: "amber", caseNumber: "IM-2026-0918" },
  ];
  return {
    role, demo: true, name: clinician ? "Dr. Sarah Adebayo" : facility ? "Lakeside Diagnostics" : admin ? "Platform team" : "Amara Okafor",
    facilityName: facility ? "Lakeside Diagnostics" : undefined, caseNumber: "IM-2026-0842", updatedAt: new Date().toISOString(),
    extensionsReady: true, subscription: clinician ? "Professional · Active" : "Standard · Active", availability: "5 published availability windows", unreadMessages: admin || facility ? 0 : 3,
    metrics: admin ? [
      { label: "Registered users", value: "2,408", detail: "Non-deleted accounts", tone: "blue" },
      { label: "Verification queue", value: "12", detail: "Providers awaiting review", tone: "amber" },
      { label: "Verified doctors", value: "86", detail: "Approved care providers", tone: "green" },
      { label: "Payment exceptions", value: "3", detail: "Require investigation", tone: "red" },
    ] : facility ? [
      { label: "Bookings today", value: "24", detail: "6 arrivals this afternoon", tone: "blue" },
      { label: "Result queue", value: "8", detail: "3 awaiting verification", tone: "amber" },
      { label: "Active services", value: "16", detail: "Published service catalogue", tone: "green" },
      { label: "Open tasks", value: "4", detail: "Facility operations", tone: "neutral" },
    ] : [
      { label: clinician ? "Appointments today" : "Upcoming appointments", value: clinician ? "8" : "3", detail: clinician ? "Next patient at 2:30 PM" : "Next appointment today", tone: "blue" },
      { label: "Pending results", value: "2", detail: "Your care team is reviewing", tone: "amber" },
      { label: "Unread messages", value: "3", detail: "Stay connected to your care", tone: "green" },
      { label: clinician ? "Open tasks" : "Pending payments", value: clinician ? "5" : "1", detail: clinician ? "2 notes need completion" : "₦15,000 outstanding", tone: "neutral" },
    ],
    appointments: admin ? [] : upcoming,
    results: admin ? [] : [
      { id: "res-1", title: "Complete blood count", subtitle: "Lakeside Diagnostics", status: "Verified", at: "2026-10-12T10:00:00Z", tone: "green" },
      { id: "res-2", title: "Lipid profile", subtitle: "Lakeside Diagnostics", status: "In review", at: "2026-10-14T10:00:00Z", tone: "amber" },
      { id: "res-3", title: "Thyroid function", subtitle: "City Health Laboratory", status: "Processing", at: "2026-10-14T10:00:00Z", tone: "blue" },
    ],
    messages: admin || facility ? [] : [
      { id: "msg-1", title: clinician ? "Amara Okafor" : "Dr. Sarah Adebayo", subtitle: "Your follow-up plan is ready. Let's discuss...", status: "Unread", at: at("10:42"), tone: "green" },
      { id: "msg-2", title: clinician ? "Daniel Williams" : "Lakeside Diagnostics", subtitle: "We've received your sample. We'll notify you...", status: "Unread", at: at("09:15") },
      { id: "msg-3", title: "Care support", subtitle: "Your appointment details have been confirmed.", status: "Unread", at: "2026-10-14T10:00:00Z" },
    ],
    timeline: admin ? [
      { id: "audit-1", title: "Provider verification reviewed", subtitle: "ADMIN · Account operation", status: "Logged", at: "2026-10-15T10:00:00Z" },
      { id: "audit-2", title: "Payment status updated", subtitle: "SYSTEM · Payment operation", status: "Logged", at: "2026-10-15T09:00:00Z" },
      { id: "audit-3", title: "Workspace access recorded", subtitle: "ADMIN · Audit event", status: "Logged", at: "2026-10-15T08:00:00Z" },
    ] : [
      { id: "tl-1", title: "Complete blood count", subtitle: "Lakeside Diagnostics · Laboratory result", status: "Verified", at: "2026-10-12T10:00:00Z", tone: "green" },
      { id: "tl-2", title: "General health consultation", subtitle: "Dr. Sarah Adebayo · Consultation", status: "Completed", at: "2026-10-08T10:00:00Z", tone: "blue" },
      { id: "tl-3", title: "Care plan updated", subtitle: "Dr. Sarah Adebayo · Clinical record", status: "Shared with you", at: "2026-10-08T11:00:00Z", tone: "green" },
      { id: "tl-4", title: "Health history completed", subtitle: "Your health record", status: "Completed", at: "2026-10-03T10:00:00Z" },
    ],
    notifications: [
      { id: "note-1", title: "Appointment reminder", subtitle: "Your appointment is coming up today.", status: "Unread", at: at("10:00") },
      { id: "note-2", title: "New results available", subtitle: "New information is available in your secure account.", status: "Unread", at: at("09:00") },
      { id: "note-3", title: "Payment received", subtitle: "Your receipt is now available.", status: "Read", at: "2026-10-12T10:00:00Z" },
    ],
    tasks: admin ? [
      { id: "task-1", title: "Review pending provider documents", subtitle: "Verification queue", status: "To do", completed: false, kind: "CARE" },
      { id: "task-2", title: "Investigate payment exceptions", subtitle: "Payment operations", status: "To do", completed: false, kind: "CARE" },
      { id: "task-3", title: "Export weekly audit report", subtitle: "Compliance", status: "Completed", completed: true, kind: "CARE" },
    ] : facility ? [
      { id: "task-1", title: "Verify pending laboratory results", subtitle: "Result queue", status: "To do", completed: false, kind: "RESULT_REVIEW" },
      { id: "task-2", title: "Review afternoon room assignments", subtitle: "Facility workload", status: "To do", completed: false, kind: "CARE" },
      { id: "task-3", title: "Update service availability", subtitle: "Service catalogue", status: "Completed", completed: true, kind: "CARE" },
    ] : [
      { id: "task-1", title: clinician ? "Finish Amara's consultation note" : "Complete your pre-visit intake", subtitle: "Before your next appointment", status: "To do", completed: false, kind: clinician ? "NOTE" : "CARE", tone: "amber" },
      { id: "task-2", title: clinician ? "Review two laboratory results" : "Book your follow-up appointment", subtitle: "Recommended by your care team", status: "To do", completed: false, kind: clinician ? "RESULT_REVIEW" : "CARE" },
      { id: "task-3", title: clinician ? "Send follow-up referral" : "Update your health history", subtitle: "Completed on October 12", status: "Completed", completed: true, kind: clinician ? "REFERRAL" : "CARE" },
    ],
    payments: [
      { id: "pay-1", title: "Consultation fee", subtitle: "₦15,000", status: "Pending", tone: "amber", at: at("09:00") },
      { id: "pay-2", title: "Laboratory service", subtitle: "₦8,500", status: "Successful", tone: "green", at: "2026-10-12T09:00:00Z" },
      { id: "pay-3", title: "Follow-up consultation", subtitle: "₦10,000", status: "Successful", tone: "green", at: "2026-10-08T09:00:00Z" },
    ],
    operations: admin ? [
      { id: "op-1", title: "Dr. Tunde Bakare", subtitle: "Doctor · Professional registration", status: "Verification pending", tone: "amber" },
      { id: "op-2", title: "Northside Diagnostics", subtitle: "Facility · Licence verification", status: "Verification pending", tone: "amber" },
      { id: "op-3", title: "Refund request · MC-2048", subtitle: "₦15,000 · Consultation cancellation", status: "Review", tone: "red" },
    ] : facility ? [
      { id: "op-1", title: "Complete blood count", subtitle: "₦8,500 · 24h turnaround", status: "Active", tone: "green" },
      { id: "op-2", title: "Lipid profile", subtitle: "₦12,000 · 48h turnaround", status: "Active", tone: "green" },
      { id: "op-3", title: "Thyroid function", subtitle: "₦18,000 · 48h turnaround", status: "Active", tone: "green" },
    ] : [
      { id: "op-1", title: "₦285,000", subtitle: "Gross collected · before refunds and fees", status: "Earnings", tone: "green" },
      { id: "op-2", title: "Consultation documentation", subtitle: "2 draft notes need completion", status: "Draft", tone: "amber" },
    ],
    trends: [
      { code: "hgb", name: "Haemoglobin", unit: "g/dL", points: [{ date: "2026-05-12", value: 11.8 }, { date: "2026-06-12", value: 12.2 }, { date: "2026-07-12", value: 12 }, { date: "2026-08-12", value: 12.8 }, { date: "2026-09-12", value: 12.6 }, { date: "2026-10-12", value: 13.2 }] },
      { code: "glucose", name: "Fasting glucose", unit: "mmol/L", points: [{ date: "2026-05-12", value: 5.7 }, { date: "2026-06-12", value: 5.5 }, { date: "2026-07-12", value: 5.6 }, { date: "2026-08-12", value: 5.3 }, { date: "2026-09-12", value: 5.4 }, { date: "2026-10-12", value: 5.1 }] },
    ],
    alerts: clinician ? [{ id: "alert-1", title: "A result needs prompt review", subtitle: "Open the secure result queue for details.", status: "Clinical alert", tone: "red" }] : [],
    insights: [
      { id: "insight-1", title: facility ? "18.4h average verification time" : admin ? "12 providers are awaiting verification" : "Your next step: a follow-up visit", subtitle: facility ? "Upload to verification · latest own uploads" : admin ? "Review professional documents before granting access." : "Keep your care plan moving. Your care team recommends a check-in.", status: "Care reminder", tone: "green" },
    ],
  };
}
