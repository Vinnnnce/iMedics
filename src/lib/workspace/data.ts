import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { patientScope, getVerifiedFacilityProfile } from "@/lib/access";
import { visibleToDoctor } from "@/lib/booking";
import { clinicInstant, clinicToday } from "@/lib/clinic-time";
import { extensionsInstalled, getTasks, extensionAudit } from "./extensions";
import { attendanceSignals, buildTrends, careGaps, scheduleSuggestions } from "./intelligence";
import type { WorkspaceData } from "./types";

const titleCase = (value: string) => value.toLowerCase().replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
const money = (amount: number, currency: string) => new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

/** No role is accepted from a query/body. The server database user determines every scope. */
export async function loadWorkspace(user: User): Promise<WorkspaceData> {
  const now = new Date();
  const ready = await extensionsInstalled();
  const data: WorkspaceData = {
    role: user.role, name: user.name, updatedAt: now.toISOString(), metrics: [], appointments: [],
    results: [], messages: [], timeline: [], notifications: [], tasks: [], payments: [],
    operations: [], trends: [], alerts: [], insights: [], subscription: "Not configured",
    availability: "Not published", extensionsReady: ready, unreadMessages: 0,
  };
  // Fail closed if the audit database cannot accept the access record.
  await extensionAudit(user, "WORKSPACE_READ");
  const [notifications, payments, tasks] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.payment.findMany({ where: user.role === "ADMIN" ? {} : { OR: [{ payerId: user.id }, { payeeId: user.id }] }, orderBy: { createdAt: "desc" }, take: 50 }),
    ready ? getTasks(user.id) : Promise.resolve([]),
  ]);
  data.tasks = tasks;
  data.notifications = notifications.map(n => ({ id: n.id, title: n.title, subtitle: n.body ?? "", at: n.createdAt.toISOString(), status: n.readAt ? "Read" : "Unread", href: n.href ?? "/notifications",
    toast: !(n.data && typeof n.data === "object" && !Array.isArray(n.data) && n.data.toast === false) }));
  data.payments = payments.map(p => ({ id: p.id, title: p.description, subtitle: money(Number(p.amount), p.currency), status: titleCase(p.status),
    tone: p.status === "SUCCESSFUL" ? "green" : p.status === "FAILED" ? "red" : "amber", at: p.createdAt.toISOString(), href: user.role === "ADMIN" ? undefined : `/payments/${p.id}` }));
  if (ready) {
    const subscriptions = await prisma.$queryRaw<{ plan: string; status: string }[]>`SELECT plan, status FROM workspace_subscriptions WHERE owner_id = ${user.id}::uuid`;
    if (subscriptions[0]) data.subscription = `${subscriptions[0].plan} · ${titleCase(subscriptions[0].status)}`;
  }
  if (user.role === "PATIENT" || user.role === "DOCTOR") {
    const scope = await patientScope(user);
    const patient = user.role === "PATIENT" ? await prisma.patient.findFirst({ where: scope.where }) : null;
    data.caseNumber = patient?.caseNumber;
    const appointmentWhere: Prisma.AppointmentWhereInput = user.role === "DOCTOR"
      ? { AND: [{ doctorId: scope.doctorId! }, visibleToDoctor] } : { patient: scope.where };
    const today = clinicInstant(clinicToday(), 0);
    const tomorrow = new Date(today.getTime() + 86400000);
    const [appointments, results, messages, histories, consultations, upcomingCount, pendingCount, unreadCount, overdueFollowUps] = await Promise.all([
      prisma.appointment.findMany({ where: { ...appointmentWhere, scheduledAt: { gte: user.role === "DOCTOR" ? today : now }, status: { in: ["BOOKED", "CONFIRMED", "IN_PROGRESS"] } }, orderBy: { scheduledAt: "asc" }, take: 50,
        include: { patient: { select: { firstName: true, lastName: true, caseNumber: true } }, doctor: { select: { specialty: true, user: { select: { name: true } } } } } }),
      prisma.labResult.findMany({ where: { patient: scope.where }, orderBy: { testDate: "desc" }, take: 50, include: { values: true, patient: { select: { caseNumber: true } } } }),
      prisma.chatMessage.findMany({ where: { conversation: user.role === "DOCTOR" ? { doctorId: scope.doctorId! } : { patient: scope.where } },
        orderBy: { createdAt: "desc" }, take: 10, include: { sender: { select: { name: true } } } }),
      prisma.medicalHistory.findMany({ where: { patient: scope.where }, orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.consultation.findMany({ where: { patient: scope.where, ...(user.role === "DOCTOR" ? { doctorId: scope.doctorId! } : { status: "FINALIZED" as const }) },
        orderBy: { createdAt: "desc" }, take: 15, select: { id: true, createdAt: true, status: true, followUpDate: true } }),
      prisma.appointment.count({ where: { ...appointmentWhere, scheduledAt: user.role === "DOCTOR" ? { gte: today, lt: tomorrow } : { gte: now }, status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] } } }),
      prisma.labResult.count({ where: { patient: scope.where, status: { notIn: ["VERIFIED", "REJECTED"] } } }),
      prisma.chatMessage.count({ where: { readAt: null, senderId: { not: user.id }, conversation: user.role === "DOCTOR" ? { doctorId: scope.doctorId! } : { patient: scope.where } } }),
      prisma.consultation.count({ where: { patient: scope.where, followUpDate: { lt: now }, status: "FINALIZED", ...(user.role === "DOCTOR" ? { doctorId: scope.doctorId! } : {}) } }),
    ]);
    const clinician = user.role === "DOCTOR";
    data.unreadMessages = unreadCount;
    data.appointments = appointments.map(a => ({ id: a.id, title: clinician ? `${a.patient.firstName} ${a.patient.lastName}` : a.doctor.user.name,
      subtitle: clinician ? a.reason ?? "Consultation" : a.doctor.specialty ?? "General consultation", at: a.scheduledAt.toISOString(),
      patientId: clinician ? a.patientId : undefined, caseNumber: a.patient.caseNumber, status: titleCase(a.status), tone: "green", href: clinician ? "/doctor/consultations" : "/patient/appointments" }));
    data.results = results.map(r => ({ id: r.id, title: r.panelType, subtitle: r.labName ?? "Laboratory result", status: titleCase(r.status), at: r.testDate.toISOString(), caseNumber: r.patient.caseNumber,
      tone: r.values.some(v => v.flag === "CRITICAL_HIGH" || v.flag === "CRITICAL_LOW") && (clinician || r.status === "VERIFIED") ? "red" : r.status === "VERIFIED" ? "green" : "amber",
      href: clinician ? "/doctor/lab-requests" : "/patient/results" }));
    // Unverified numerical results and AI content must never leak into patient trends.
    data.trends = clinician ? [] : buildTrends(results.filter(r => r.status === "VERIFIED").flatMap(r => r.values.filter(v => v.numericValue !== null).map(v => ({
      code: v.code, name: v.name, unit: v.unit, value: v.numericValue!, date: r.testDate.toISOString(),
    }))));
    data.alerts = data.results.filter(r => r.tone === "red").map(r => ({ ...r, title: `Critical result: ${r.title}`, subtitle: clinician ? "Review this result promptly." : "Contact your care team promptly.", status: "Needs attention" }));
    data.messages = messages.map(m => ({ id: m.id, title: m.sender.name, subtitle: "Open your secure conversation.", at: m.createdAt.toISOString(),
      status: !m.readAt && m.senderId !== user.id ? "Unread" : "Read", href: clinician ? "/doctor/chat" : "/patient/consult" }));
    data.timeline = [
      ...data.results,
      ...histories.map(h => ({ id: h.id, title: "Health history updated", subtitle: "Health record", status: titleCase(h.status), at: h.createdAt.toISOString(), href: clinician ? "/doctor/patients" : "/patient/history" })),
      ...consultations.map(c => ({ id: c.id, title: "Consultation", subtitle: "Consultation record", status: titleCase(c.status), at: c.createdAt.toISOString(), href: clinician ? "/doctor/consultations" : "/patient/case-file" })),
    ].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? "")).slice(0, 30);
    const pendingPaymentCount = await prisma.payment.count({ where: { payerId: user.id, status: "PENDING" } });
    data.metrics = [
      { label: clinician ? "Appointments today" : "Upcoming appointments", value: String(upcomingCount), detail: clinician ? "Clinic time · WAT" : "Your next steps in care", tone: "blue" },
      { label: "Pending results", value: String(pendingCount), detail: "Awaiting clinical review", tone: "amber" },
      { label: "Unread messages", value: String(unreadCount), detail: "Your secure conversations", tone: "green" },
      { label: clinician ? "Open tasks" : "Pending payments", value: String(clinician ? tasks.filter(t => !t.completed).length : pendingPaymentCount), detail: clinician ? "Keep care moving forward" : "View your outstanding invoices", tone: "neutral" },
    ];
    data.insights = careGaps({ intakeComplete: histories.some(h => h.status === "COMPLETE"), overdueFollowUps, pendingReviews: pendingCount });
    if (clinician) {
      data.insights = data.insights.map(i => ({ ...i, href: i.id === "review-gap" ? "/doctor/lab-requests" : "/doctor/patients" }));
      data.operations = consultations.filter(c => c.status === "DRAFT").map(c => ({ id: c.id, title: "Complete consultation documentation", subtitle: "Draft consultation", status: "Draft", href: "/doctor/consultations", at: c.createdAt.toISOString(), tone: "amber" }));
      const schedule = await prisma.doctorSchedule.count({ where: { doctorId: scope.doctorId!, isActive: true } });
      data.availability = `${schedule} published availability window${schedule === 1 ? "" : "s"}`;
      const missed = await prisma.appointment.groupBy({ by: ["patientId"], where: { doctorId: scope.doctorId!, status: "NO_SHOW", patientId: { in: appointments.map(a => a.patientId) } }, _count: { id: true } });
      for (const appointment of appointments) {
        const signal = attendanceSignals({ previousNoShows: missed.find(m => m.patientId === appointment.patientId)?._count.id ?? 0,
          bookedDaysAhead: (appointment.scheduledAt.getTime() - appointment.createdAt.getTime()) / 86400000, confirmed: appointment.status !== "BOOKED" });
        if (signal.level === "Review") data.insights.push({ id: `attendance-${appointment.id}`, title: `Reminder priority: ${appointment.patient.firstName} ${appointment.patient.lastName}`,
          subtitle: `${signal.reasons.join(" · ")}. Rule-based, not a risk probability.`, status: "Review", tone: "amber", href: "/doctor/booking-requests" });
      }
      for (const gap of scheduleSuggestions(appointments.map(a => ({ at: a.scheduledAt.toISOString(), durationMinutes: a.durationMinutes })))) {
        data.insights.push({ id: `gap-${gap.startsAt}`, title: `${gap.minutes}-minute schedule gap`, subtitle: gap.suggestion, at: gap.startsAt, status: "Suggestion", href: "/doctor/schedule", tone: "blue" });
      }
      // Keep currency totals separate rather than summing incompatible currencies.
      const earnings = await prisma.payment.groupBy({ by: ["currency"], where: { payeeId: user.id, status: "SUCCESSFUL" }, _sum: { amount: true } });
      data.operations.push(...earnings.map(e => ({ id: `earnings-${e.currency}`, title: money(Number(e._sum.amount ?? 0), e.currency), subtitle: "Gross collected · before refunds and fees", status: "Earnings", href: "/payments" })));
    }
  } else if (user.role === "LAB_SCIENTIST") {
    const facility = await getVerifiedFacilityProfile(user);
    data.facilityName = facility.laboratoryName ?? user.name;
    const [bookings, services, uploads, totalBookings] = await Promise.all([
      prisma.facilityBooking.findMany({ where: { service: { facilityId: facility.id }, OR: [{ payment: null }, { payment: { status: { in: ["SUCCESSFUL", "REFUND_PENDING", "REFUNDED"] } } }] }, orderBy: { preferredAt: "asc" }, take: 50,
        include: { patient: { select: { firstName: true, lastName: true, caseNumber: true } } } }),
      prisma.facilityService.findMany({ where: { facilityId: facility.id }, take: 100 }),
      // The legacy lab model has no facility assignment. Only the caller's own uploads
      // may enter this dashboard, never a global patient/result queue.
      prisma.labResult.findMany({ where: { uploadedById: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.facilityBooking.count({ where: { service: { facilityId: facility.id }, status: { in: ["REQUESTED", "CONFIRMED"] } } }),
    ]);
    data.appointments = bookings.map(b => ({ id: b.id, title: `${b.patient.firstName} ${b.patient.lastName}`, subtitle: b.serviceName, caseNumber: b.patient.caseNumber, at: b.preferredAt.toISOString(), status: titleCase(b.status), href: "/lab/bookings", tone: "blue" }));
    data.results = uploads.map(r => ({ id: r.id, title: r.panelType, subtitle: "Your uploaded result", status: titleCase(r.status), at: r.createdAt.toISOString(), href: "/lab/orders", tone: r.status === "VERIFIED" ? "green" : "amber" }));
    data.operations = services.map(s => ({ id: s.id, title: s.name, subtitle: `${money(Number(s.price), s.currency)} · ${s.turnaroundHours ? `${s.turnaroundHours}h target` : "No turnaround target"}`, status: s.isActive ? "Active" : "Inactive", href: "/lab/services" }));
    const revenue = await prisma.payment.groupBy({ by: ["currency"], where: { payeeId: user.id, status: "SUCCESSFUL" }, _sum: { amount: true } });
    data.operations.push(...revenue.map(r => ({ id: `revenue-${r.currency}`, title: money(Number(r._sum.amount ?? 0), r.currency), subtitle: "Gross collected · before refunds and fees", status: "Revenue", href: "/payments" })));
    data.metrics = [
      { label: "Open bookings", value: String(totalBookings), detail: "Requested and confirmed", tone: "blue" },
      { label: "Result queue", value: String(uploads.filter(r => r.status !== "VERIFIED" && r.status !== "REJECTED").length), detail: "Your uploads · latest 50", tone: "amber" },
      { label: "Active services", value: String(services.filter(s => s.isActive).length), detail: "Published service catalogue", tone: "green" },
      { label: "Open tasks", value: String(tasks.filter(t => !t.completed).length), detail: "Facility operations" },
    ];
    const turnaround = uploads.filter(r => r.verifiedAt).map(r => (r.verifiedAt!.getTime() - r.createdAt.getTime()) / 3600000);
    data.insights = [{ id: "turnaround", title: turnaround.length ? `${(turnaround.reduce((a, b) => a + b, 0) / turnaround.length).toFixed(1)}h average verification time` : "No verified uploads yet",
      subtitle: "Upload to verification · latest 50 own uploads", status: "Turnaround", href: "/lab/orders" }];
  } else {
    // Admin receives operational metadata only. Never load clinical records or message bodies.
    const [users, pending, providers, audit] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.findMany({ where: { deletedAt: null, status: "PENDING" }, take: 50, select: { id: true, name: true, accountType: true, createdAt: true } }),
      prisma.doctorProfile.count({ where: { verificationStatus: "VERIFIED" } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { id: true, action: true, actorRole: true, createdAt: true } }),
    ]);
    data.metrics = [
      { label: "Registered users", value: String(users), detail: "Non-deleted accounts", tone: "blue" },
      { label: "Verification queue", value: String(pending.length), detail: "Latest 50 pending accounts", tone: "amber" },
      { label: "Verified doctors", value: String(providers), detail: "Approved care providers", tone: "green" },
      { label: "Payment exceptions", value: String(payments.filter(p => ["FAILED", "REFUND_PENDING"].includes(p.status)).length), detail: "Latest 50 payments", tone: "red" },
    ];
    data.operations = pending.map(u => ({ id: u.id, title: u.name, subtitle: titleCase(u.accountType ?? "Professional"), status: "Verification pending", at: u.createdAt.toISOString(), href: "/admin/dashboard", tone: "amber" }));
    data.timeline = audit.map(a => ({ id: a.id, title: titleCase(a.action), subtitle: a.actorRole ?? "System", at: a.createdAt.toISOString(), status: "Logged" }));
    data.alerts = data.payments.filter(p => p.status === "Refund pending" || p.status === "Failed");
  }
  return data;
}
