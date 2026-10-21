"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import {
  Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, Bell, CalendarDays,
  ChevronRight, ClipboardList, FileText, FlaskConical,
  Heart, LayoutDashboard, LockKeyhole, Menu, MessageSquare, Moon,
  Plus, Search, Settings, ShieldCheck, Sparkles, Sun, Upload, Users, Wallet,
} from "lucide-react";
import type { WorkspaceData, WorkspaceDocument, WorkspaceItem, WorkspaceRole, WorkspaceShare } from "@/lib/workspace/types";
import { consultationTemplates, csvCell } from "@/lib/workspace/intelligence";
import { wearableImportSchema } from "@/lib/workspace/validation";
import { subscribeWithVapidKey } from "@/lib/notifications/browser-push";
import { Card, DataTable, EmptyState, ItemList, Modal, StatusChip, Toast, TrendChart } from "./ui";
import "./workspace.css";

type View = "overview" | "appointments" | "records" | "messages" | "payments" | "insights" | "operations" | "settings";
const roleNames = { PATIENT: "Patient", DOCTOR: "Doctor", LAB_SCIENTIST: "Facility", ADMIN: "Admin" };
function navigate(path: string) {
  // Full-document navigation intentionally crosses from the isolated additive portal
  // back into the untouched legacy shell. This also works outside Next in the preview.
  if (/^\/(?!\/)/.test(path)) window.location.assign(path);
}
const nav = [
  { id: "overview", name: "Overview", icon: LayoutDashboard },
  { id: "appointments", name: "Appointments", icon: CalendarDays },
  { id: "records", name: "Health records", icon: FileText },
  { id: "messages", name: "Messages", icon: MessageSquare },
  { id: "payments", name: "Payments", icon: Wallet },
  { id: "insights", name: "Health insights", icon: Activity },
] as const;

async function api<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(`/api${path}`, body === undefined ? { cache: "no-store" } : {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json.error || json.message || "This action could not be completed.");
  }
  return response.json();
}
function saveCsv(name: string, rows: unknown[][]) {
  const url = URL.createObjectURL(new Blob([rows.map(r => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const dateLabel = (date?: string) => date ? new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Not scheduled";
const timeLabel = (date?: string) => date ? new Date(date).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" }) : "Time to be confirmed";

/** Isolate the new shell from the unchanged legacy root navbar without editing it. */
export function WorkspaceDashboard(props: { initialData: WorkspaceData; onDemoRole?: (role: WorkspaceRole) => void }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const node = document.createElement("div");
    node.setAttribute("data-workspace-root", "true");
    const siblings = [...document.body.children].filter((n): n is HTMLElement => n instanceof HTMLElement && !["SCRIPT", "STYLE", "LINK"].includes(n.tagName));
    const previous = siblings.map(n => ({ n, inert: n.inert, hidden: n.hidden }));
    siblings.forEach(n => { n.inert = true; n.hidden = true; });
    document.body.appendChild(node);
    // The portal host is an external DOM resource created after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHost(node);
    return () => { previous.forEach(({ n, inert, hidden }) => { n.inert = inert; n.hidden = hidden; }); node.remove(); };
  }, []);
  return host ? createPortal(<DashboardSurface key={props.initialData.role} {...props} />, host) : <p role="status">Loading your workspace...</p>;
}

function DashboardSurface({ initialData, onDemoRole }: { initialData: WorkspaceData; onDemoRole?: (role: WorkspaceRole) => void }) {
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<View>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [dark, setDark] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [modal, setModal] = useState<string | null>(null);
  const [selected, setSelected] = useState<WorkspaceItem | null>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [inline, setInline] = useState("");
  const [trendIndex, setTrendIndex] = useState(0);
  const [period, setPeriod] = useState("6 months");
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [shares, setShares] = useState<WorkspaceShare[]>([]);
  const [shareDoctors, setShareDoctors] = useState<{ id: string; name: string; specialty?: string }[]>(initialData.demo ? [{ id: "demo-doctor", name: "Dr. Sarah Adebayo", specialty: "General practice" }] : []);
  const [operations, setOperations] = useState<{ disputes: Record<string, string>[]; subscriptions: Record<string, string>[]; resources: Record<string, string>[] }>({ disputes: [], subscriptions: [], resources: [] });
  const [wearables, setWearables] = useState<{ metric: string; value: number; recorded_at: string; source: string }[]>([]);
  const [template, setTemplate] = useState<keyof typeof consultationTemplates>("SOAP");
  const [note, setNote] = useState(consultationTemplates.SOAP);
  const [uploaded, setUploaded] = useState<File | null>(null);
  const [intakeSaved, setIntakeSaved] = useState(false);
  const closeToast = useCallback(() => setToast(null), []);
  const patient = data.role === "PATIENT", doctor = data.role === "DOCTOR", facility = data.role === "LAB_SCIENTIST", admin = data.role === "ADMIN";
  const demo = Boolean(data.demo);
  const displayName = patient ? data.name.split(" ")[0] : data.name;
  const unread = data.notifications.filter(n => n.status === "Unread").length;
  const knownNotifications = useRef(new Set(initialData.notifications.map(n => n.id)));
  useEffect(() => {
    if (demo) return;
    let active = true;
    const refresh = async () => {
      if (document.hidden || !navigator.onLine) return;
      try {
        const fresh = await api<WorkspaceData>("/workspace");
        if (active) {
          const newNotice = fresh.notifications.find(n => n.status === "Unread" && n.toast !== false && !knownNotifications.current.has(n.id));
          if (newNotice) setToast({ text: newNotice.title });
          knownNotifications.current = new Set(fresh.notifications.map(n => n.id));
          setData(fresh);
        }
      } catch { /* Keep last successful snapshot; explicit refresh reports errors. */ }
    };
    const timer = setInterval(refresh, 60000);
    return () => { active = false; clearInterval(timer); };
  }, [demo]);
  useEffect(() => {
    if (demo || !data.extensionsReady) return;
    if (view === "records" && (patient || doctor)) {
      api<{ documents: WorkspaceDocument[]; shares: WorkspaceShare[] }>("/workspace/documents").then(r => { setDocuments(r.documents); setShares(r.shares); }).catch(e => setToast({ text: e.message, error: true }));
    }
    if (view === "operations") api<typeof operations>("/workspace/operations").then(setOperations).catch(e => setToast({ text: e.message, error: true }));
    if (view === "insights" && patient) api<typeof wearables>("/workspace/wearables").then(setWearables).catch(e => setToast({ text: e.message, error: true }));
  }, [view, demo, data.extensionsReady, patient, doctor]);
  useEffect(() => {
    if (!demo && modal === "share") api<{ doctors: typeof shareDoctors }>("/doctors?limit=50")
      .then(r => setShareDoctors(r.doctors)).catch(e => setToast({ text: e.message, error: true }));
  }, [demo, modal]);

  const changeView = (next: View) => { setView(next); setQuery(""); setFilter("All"); setInline(""); setMobileNav(false); };
  const openModal = (name: string) => { setInline(""); setModal(name); };
  const openItem = (item: WorkspaceItem) => { setSelected(item); openModal("detail"); };
  const filtered = (items: WorkspaceItem[]) => items.filter(item =>
    `${item.title} ${item.subtitle} ${item.caseNumber ?? ""}`.toLowerCase().includes(query.toLowerCase()) &&
    (filter === "All" || item.status === filter));
  async function perform(work: () => Promise<void>, success?: string) {
    setBusy(true); setInline("");
    try { await work(); if (success) { setInline(success); setToast({ text: success }); } }
    catch (e) { const text = e instanceof Error ? e.message : "Something went wrong."; setInline(text); setToast({ text, error: true }); }
    finally { setBusy(false); }
  }
  async function toggleTask(id: string) {
    const task = data.tasks.find(t => t.id === id)!;
    await perform(async () => {
      if (!demo) await api("/workspace/tasks", { id, completed: !task.completed }, "PATCH");
      setData(d => ({ ...d, tasks: d.tasks.map(t => t.id === id ? { ...t, completed: !t.completed, status: t.completed ? "To do" : "Completed" } : t) }));
    }, task.completed ? "Task reopened" : "Task completed");
  }
  async function addTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    await perform(async () => {
      const title = String(f.get("title")).trim(), kind = String(f.get("kind") || "CARE");
      const result = demo ? { id: `task-${Date.now()}` } : await api<{ id: string }>("/workspace/tasks", { title, kind });
      setData(d => ({ ...d, tasks: [...d.tasks, { id: result.id, title, kind, subtitle: "Added just now", status: "To do", completed: false }] }));
      setModal(null);
    }, "Task added");
  }
  async function markRead() {
    await perform(async () => {
      if (!demo) await api("/notifications/read", {});
      setData(d => ({ ...d, notifications: d.notifications.map(n => ({ ...n, status: "Read" })) }));
    }, "Notifications marked as read");
  }
  async function uploadDocument(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!uploaded) return;
    await perform(async () => {
      if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(uploaded.type) || uploaded.size > 15 * 1024 * 1024 || !uploaded.size) throw new Error("Choose a PDF, PNG, JPEG or WebP file under 15 MB.");
      let id = `doc-${Date.now()}`;
      if (!demo) {
        const init = await api<{ id: string; uploadUrl: string }>("/workspace/documents", { action: "initiate", fileName: uploaded.name, mimeType: uploaded.type, sizeBytes: uploaded.size });
        const response = await fetch(init.uploadUrl, { method: "PUT", headers: { "Content-Type": uploaded.type }, body: uploaded });
        if (!response.ok) throw new Error("Upload failed. Please try again.");
        await api("/workspace/documents", { action: "confirm", id: init.id }); id = init.id;
      }
      setDocuments(d => [...d, { id, file_name: uploaded.name, mime_type: uploaded.type, size_bytes: uploaded.size, created_at: new Date().toISOString(), confirmed_at: new Date().toISOString() }]);
      setUploaded(null); setModal(null);
    }, demo ? "Demo document added to this preview session" : "Document uploaded and verified");
  }
  async function shareDocument(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    await perform(async () => {
      const body = { action: "share", id: String(f.get("document")), doctorId: String(f.get("doctor")), days: Number(f.get("days")), consent: true };
      const result = demo ? { id: `share-${Date.now()}` } : await api<{ id: string }>("/workspace/documents", body);
      setShares(s => [...s, { id: result.id, document_id: body.id, recipient_name: shareDoctors.find(d => d.id === body.doctorId)?.name ?? "Selected doctor", expires_at: new Date(Date.now() + body.days * 86400000).toISOString(), revoked_at: null }]);
      setModal(null);
    }, "Record access granted");
  }
  async function submitIntake(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    await perform(async () => {
      if (!demo) await api("/workspace/intake", { appointmentId: String(f.get("appointment")), reason: String(f.get("reason")), medications: String(f.get("medications")), allergies: String(f.get("allergies")), consent: true });
      setIntakeSaved(true); setModal(null);
    }, "Pre-visit intake saved");
  }
  async function operationAction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    await perform(async () => {
      const action = String(f.get("action"));
      const body: Record<string, unknown> = Object.fromEntries(f.entries());
      if (action === "resource") body.capacity = Number(body.capacity);
      if (action === "refund") body.confirm = true;
      if (!demo) await api("/workspace/operations", body);
      if (!demo) setOperations(await api("/workspace/operations"));
      else {
        const id = `op-${Date.now()}`;
        if (action === "resource") setOperations(o => ({ ...o, resources: [...o.resources, { id, name: String(body.name), kind: String(body.kind), capacity: String(body.capacity), assignments: "0", booked_hours: "0", active: "true" }] }));
        if (action === "subscription") setOperations(o => ({ ...o, subscriptions: [...o.subscriptions, { id, plan: String(body.plan), status: String(body.status), name: "Preview account" }] }));
        if (action === "dispute") setOperations(o => ({ ...o, disputes: [...o.disputes, { id, payment_id: String(body.paymentId), reason: String(body.reason), status: "OPEN", created_at: new Date().toISOString() }] }));
        if (action === "resolve") setOperations(o => ({ ...o, disputes: o.disputes.map(d => d.id === body.id ? { ...d, status: String(body.status) } : d) }));
        if (action === "refund") setData(d => ({ ...d, payments: d.payments.map(p => p.id === body.paymentId ? { ...p, status: "Refund pending", tone: "amber" } : p) }));
      }
      setModal(null);
    }, demo ? "Demo operation recorded for this session" : "Operation saved");
  }
  const next = data.appointments[0];
  const clinicDate = (value: string | Date) => new Date(value).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  const todaysAppointments = data.appointments.filter(a => a.at && clinicDate(a.at) === clinicDate(new Date()));
  const trend = data.trends[trendIndex] ?? data.trends[0];
  const filteredTrend = trend ? { ...trend, points: period === "3 months" ? trend.points.slice(-3) : trend.points } : undefined;
  const remaining = data.tasks.filter(t => !t.completed).length;
  const pageTitle = view === "overview" ? "Your care, at a glance" : view === "records" ? facility ? "Result queue" : "Health records" : view === "insights" ? patient ? "Health insights" : "Intelligence" : view === "operations" ? admin ? "Platform operations" : facility ? "Facility operations" : "Clinical workspace" : nav.find(n => n.id === view)?.name ?? "Settings";
  function exportItems() {
    const items = view === "payments" ? data.payments : view === "appointments" ? data.appointments : view === "operations" ? data.operations : data.timeline;
    saveCsv(`medic1905-${view}.csv`, [["Title", "Details", "Status", "Date"], ...items.map(i => [i.title, i.subtitle, i.status, i.at])]);
    setToast({ text: "CSV exported" });
  }
  const taskPanel = <Card title={doctor ? "Clinical task queue" : admin || facility ? "Operations checklist" : "Your care checklist"} action={<button className="ws-icon-button" data-testid="add-task" aria-label="Add task" onClick={() => openModal("task")} disabled={!data.extensionsReady}><Plus size={19} /></button>}>
    <div className="ws-checklist-meta"><span>{remaining} tasks remaining</span><span>{data.tasks.filter(t => t.completed).length}/{data.tasks.length} complete</span></div>
    <div className="ws-progress"><span style={{ width: `${data.tasks.length ? data.tasks.filter(t => t.completed).length / data.tasks.length * 100 : 0}%` }} /></div>
    {!data.tasks.length ? <EmptyState title="Make room for what matters" detail="Add your first care task." /> : data.tasks.map(t => <label key={t.id} className={`ws-task ${t.completed ? "ws-task-done" : ""}`}><input data-testid={`task-checkbox-${t.id}`} type="checkbox" checked={t.completed} onChange={() => toggleTask(t.id)} disabled={busy} /><span><strong>{t.title}</strong><small>{t.subtitle}</small></span></label>)}
  </Card>;
  const trendPanel = <Card title="Your health over time" action={<select aria-label="Chart period" data-testid="chart-period" className="ws-select" value={period} onChange={e => setPeriod(e.target.value)}><option>6 months</option><option>3 months</option></select>}>
    {filteredTrend ? <><div className="ws-chart-top"><div><select data-testid="trend-select" aria-label="Result to chart" className="ws-chart-select" value={trendIndex} onChange={e => setTrendIndex(Number(e.target.value))}>{data.trends.map((t, i) => <option key={t.code} value={i}>{t.name}</option>)}</select><p><strong>{filteredTrend.points.at(-1)?.value}</strong><span>{trend.unit}</span></p></div><StatusChip tone="neutral">Verified results only</StatusChip></div><TrendChart trend={filteredTrend} /><p className="ws-caption">Results are informational. Discuss changes with your clinician.</p></> : <EmptyState title="Your story is still taking shape" detail="At least two verified results of the same test and unit are needed to show a trend." />}
  </Card>;

  return <div className="ws-app" data-theme={dark ? "dark" : "light"}>
    <a className="ws-skip" href="#workspace-content">Skip to content</a>
    {mobileNav && <button aria-label="Close navigation" className="ws-nav-backdrop" onClick={() => setMobileNav(false)} />}
    <aside className={`ws-sidebar ${mobileNav ? "ws-sidebar-open" : ""}`}>
      <a href={demo ? "#" : "/"} className="ws-brand" onClick={e => { if (demo) { e.preventDefault(); changeView("overview"); } }} aria-label="Medic1905 home">
        <Image src="/medic1905-logo.png" alt="Medic1905" width={116} height={45} className="h-8 w-auto" />
      </a>
      <div className="ws-portal-label">{roleNames[data.role]} portal<StatusChip tone="green">Secure</StatusChip></div>
      <p className="ws-nav-label">WORKSPACE</p>
      <nav aria-label="Workspace navigation">
        {nav.filter(n => !((admin && ["appointments", "records", "messages"].includes(n.id)) || (facility && ["messages"].includes(n.id)))).map(n => <button key={n.id} data-testid={`nav-${n.id}`} onClick={() => changeView(n.id)} className={view === n.id ? "ws-nav-active" : ""} aria-current={view === n.id ? "page" : undefined}><n.icon size={19} /><span>{facility && n.id === "records" ? "Results" : facility && n.id === "appointments" ? "Bookings" : !patient && n.id === "insights" ? "Intelligence" : n.name}</span>{n.id === "messages" && data.unreadMessages > 0 && <small>{data.unreadMessages}</small>}</button>)}
        {!patient && <button data-testid="nav-operations" onClick={() => changeView("operations")} className={view === "operations" ? "ws-nav-active" : ""}><Users size={19} /><span>{admin ? "Administration" : facility ? "Operations" : "Clinical workspace"}</span></button>}
      </nav>
      <div className="ws-sidebar-bottom">
        <div className="ws-support"><span className="ws-support-symbol"><Heart size={23} /></span><strong>A little support goes a long way.</strong><p>Your care team is here for you.</p><button data-testid="contact-support" onClick={() => { setSelected({ id: "support", title: "Care support", subtitle: "For clinical questions, contact your care team through secure messages. For account help, use your facility's support channel.", status: "Support" }); openModal("detail"); }}>Get support <ArrowUpRight size={15} /></button></div>
        <button className="ws-bottom-link" data-testid="nav-settings" onClick={() => changeView("settings")}><Settings size={18} />Settings</button>
        <div className="ws-private"><LockKeyhole size={13} /> Your health. Your privacy.</div>
      </div>
    </aside>
    <div className="ws-body">
      <header className="ws-header">
        <div className="ws-breadcrumb"><button className="ws-icon-button ws-mobile-menu" aria-label="Open navigation" data-testid="open-navigation" onClick={() => setMobileNav(true)}><Menu size={21} /></button><span>Workspace</span><ChevronRight size={14} /><strong>{view === "overview" ? "Overview" : pageTitle}</strong></div>
        <div className="ws-header-actions">
          {demo && <label className="ws-role-select"><span>Preview as</span><select data-testid="role-select" aria-label="Preview role" value={data.role} onChange={e => onDemoRole?.(e.target.value as WorkspaceRole)}>{Object.entries(roleNames).map(([r, n]) => <option key={r} value={r}>{n}</option>)}</select></label>}
          <button className="ws-icon-button" data-testid="theme-toggle" aria-label={dark ? "Use light theme" : "Use dark theme"} onClick={() => setDark(!dark)}>{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
          <button className="ws-icon-button ws-bell" data-testid="notification-centre" aria-label={`Notifications, ${unread} unread`} onClick={() => openModal("notifications")}><Bell size={20} />{unread > 0 && <span />}</button>
          <div className="ws-profile-avatar">{data.name.replace(/^Dr\.\s*/, "").split(" ").slice(0, 2).map(n => n[0]).join("")}</div>
        </div>
      </header>
      <main id="workspace-content" tabIndex={-1} className="ws-main">
        {demo && <div className="ws-demo-banner"><ShieldCheck size={14} /><span>Interactive preview · Synthetic records only · Changes reset on reload</span></div>}
        <div className="ws-title-row"><div><div className="ws-eyebrow">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div><h1>{view === "overview" ? patient ? `Good to see you, ${displayName}` : doctor ? `Your day, ${displayName}` : facility ? "Care starts with your team" : "A clear view of your platform" : pageTitle}{view === "overview" && <span className="ws-greeting-dot">.</span>}</h1><p>{view === "overview" ? patient ? "A clearer picture of your health. One step at a time." : doctor ? "Your patients, clinical priorities and practice in one place." : facility ? "Keep bookings, results and your facility moving together." : "Review the priorities that keep care running smoothly." : "Everything you need, with the next action close at hand."}</p></div>
          <button className="ws-button ws-primary" data-testid="primary-action" onClick={() => patient ? openModal("book") : doctor ? openModal("template") : admin ? changeView("operations") : openModal("resource")}><Plus size={17} />{patient ? "Book appointment" : doctor ? "New consultation" : admin ? "Manage platform" : "Add resource"}</button>
        </div>
        {!data.extensionsReady && <div role="status" className="ws-warning">Workspace extensions are not installed. Ask your operator to apply the additive database migration. Existing clinical workflows remain available.</div>}
        {data.alerts.length > 0 && <div className="ws-critical" role="alert"><ShieldCheck size={20} /><div><strong>{data.alerts[0].title}</strong><p>{data.alerts[0].subtitle}</p></div><button className="ws-button" onClick={() => openItem(data.alerts[0])}>Review <ArrowRight size={15} /></button></div>}
        {view === "overview" ? <>
          <div className="ws-metrics">{data.metrics.map((m, i) => { const Icon = [CalendarDays, FlaskConical, MessageSquare, Wallet][i]; return <button key={m.label} data-testid={`metric-${i}`} className="ws-metric" onClick={() => changeView(admin ? "operations" : i === 0 ? "appointments" : i === 1 ? "records" : i === 2 ? "messages" : doctor ? "operations" : "payments")}><div><span>{m.label}</span><Icon size={18} className={`ws-text-${m.tone}`} /></div><strong>{m.value}</strong><p><span className={`ws-small-dot ws-dot-${m.tone}`} />{m.detail}</p></button>; })}</div>
          <div className="ws-overview-grid"><div className="ws-main-column">
            {!admin && <Card title={doctor ? "Next patient" : facility ? "Next booking" : "Your next appointment"} action={<button className="ws-text-button" onClick={() => changeView("appointments")}>View all <ArrowUpRight size={15} /></button>} className="ws-next-card">
              {next ? <><div className="ws-appointment-summary"><div className="ws-doctor-avatar">{doctor || facility ? "AO" : "SA"}</div><div><div className="ws-next-label">{doctor ? next.caseNumber : facility ? "FACILITY BOOKING" : "YOUR CARE TEAM"}</div><h3>{next.title}</h3><p>{next.subtitle}</p></div><StatusChip tone="green">{next.status}</StatusChip></div><div className="ws-appointment-bottom"><div><CalendarDays size={17} /><span>{dateLabel(next.at)}<small>Appointment date</small></span></div><div><Activity size={17} /><span>{timeLabel(next.at)}<small>West Africa Time</small></span></div><button className="ws-button ws-primary" data-testid="view-next-appointment" onClick={() => openItem(next)}>View appointment <ArrowUpRight size={16} /></button></div>{patient && <button className="ws-intake-link" data-testid="complete-intake" onClick={() => openModal("intake")}><ClipboardList size={16} />{intakeSaved ? "Intake saved. Update your details" : "Be ready for your visit. Complete pre-visit intake"}<ArrowRight size={16} /></button>}</> : <EmptyState title="Your next chapter in care" detail="Upcoming appointments will appear here." action={<button className="ws-button" onClick={() => openModal("book")}>Find a doctor</button>} />}
            </Card>}
            {admin ? <Card title="Provider verification" action={<button className="ws-text-button" onClick={() => changeView("operations")}>Manage <ArrowUpRight size={15} /></button>}><DataTable items={data.operations} onOpen={openItem} heading="Provider" /></Card> : patient ? trendPanel : <Card title={doctor ? "Today's schedule" : "Booking queue"} action={<StatusChip tone="blue">WAT</StatusChip>}><DataTable items={doctor ? todaysAppointments : data.appointments} onOpen={openItem} heading={doctor ? "Patient" : "Booking"} /></Card>}
            <Card title={admin ? "Recent audit activity" : "Your health timeline"} action={<button className="ws-text-button" onClick={() => changeView(admin ? "operations" : "records")}>View history <ArrowUpRight size={15} /></button>}>
              {!data.timeline.length ? <EmptyState title="Your timeline starts here" detail="Visits, results and shared records will come together here." /> : <div className="ws-timeline">{data.timeline.slice(0, 3).map((t, i) => <button key={t.id} data-testid={`timeline-${t.id}`} onClick={() => openItem(t)}><span className={`ws-timeline-marker ws-marker-${i}`}><FileText size={16} /></span><span><strong>{t.title}</strong><small>{t.subtitle}</small></span><time>{dateLabel(t.at)}</time><ChevronRight size={16} /></button>)}</div>}
            </Card>
          </div><div className="ws-side-column">
            <Card className="ws-care-note"><div className="ws-note-top"><Sparkles size={21} /><span>LOOKING AHEAD</span></div><h2>{data.insights[0]?.title ?? "Small steps. Better care."}</h2><p>{data.insights[0]?.subtitle ?? "Stay connected to your care team and keep your records up to date."}</p><button className="ws-text-button" data-testid="care-insight" onClick={() => changeView("insights")}>See your next steps <ArrowRight size={17} /></button></Card>
            {taskPanel}
            {!admin && !facility && <Card title="Recent messages" action={<button className="ws-icon-button" aria-label="All messages" data-testid="all-messages" onClick={() => changeView("messages")}><ArrowUpRight size={19} /></button>}><ItemList items={data.messages.slice(0, 2)} onOpen={openItem} empty="Your secure inbox is ready" /></Card>}
            {(doctor || facility) && <Card title={doctor ? "Your practice" : "Facility summary"}><div className="ws-practice"><p><span>Subscription</span><strong>{data.subscription}</strong></p><p><span>{doctor ? "Availability" : "Facility"}</span><strong>{doctor ? data.availability : data.facilityName}</strong></p><button className="ws-text-button" onClick={() => changeView("operations")}>Manage workspace <ArrowRight size={16} /></button></div></Card>}
          </div></div>
        </> : <>
          <div className="ws-toolbar"><label className="ws-search"><Search size={18} /><input data-testid="workspace-search" aria-label="Search this view by name, details or case number" placeholder="Search by name, detail or case number..." value={query} onChange={e => setQuery(e.target.value)} /></label>{!["settings", "insights"].includes(view) && <button className="ws-button" data-testid="export-view" onClick={exportItems}><ArrowDownToLine size={16} />Export CSV</button>}{["appointments", "records", "payments"].includes(view) && <select data-testid="status-filter" aria-label="Filter by status" className="ws-select" value={filter} onChange={e => setFilter(e.target.value)}><option>All</option>{[...new Set((view === "appointments" ? data.appointments : view === "payments" ? data.payments : data.results).map(i => i.status))].map(s => <option key={s}>{s}</option>)}</select>}</div>
          {view === "appointments" && <Card title={facility ? "Your facility bookings" : doctor ? "Your schedule" : "Your appointments"}><DataTable items={filtered(data.appointments)} onOpen={openItem} heading={doctor ? "Patient" : "Appointment"} /></Card>}
          {view === "records" && <div className="ws-detail-grid"><div><Card title={facility ? "Result queue" : "Laboratory results"}><DataTable items={filtered(data.results)} onOpen={openItem} heading="Test" /></Card><Card title="Record timeline"><ItemList items={filtered(data.timeline)} onOpen={openItem} /></Card></div><div>{!facility && !admin && <Card title="Your documents" action={patient && <button className="ws-icon-button" data-testid="upload-document" aria-label="Upload document" onClick={() => openModal("upload")} disabled={!data.extensionsReady}><Upload size={18} /></button>}>
            {!documents.length ? <EmptyState title="Keep your records together" detail={patient ? "Upload a report, scan or referral." : "Documents explicitly shared with you appear here."} /> : <div className="ws-document-list">{documents.map(d => <button key={d.id} data-testid={`download-${d.id}`} onClick={() => perform(async () => { if (demo) { setToast({ text: "Preview stores file details only, not file contents" }); return; } const { url } = await api<{ url: string }>(`/workspace/documents?id=${d.id}`); window.open(url, "_blank", "noopener,noreferrer"); })}><FileText size={20} /><span><strong>{d.file_name}</strong><small>{Math.ceil(d.size_bytes / 1024)} KB</small></span><ArrowDownToLine size={16} /></button>)}</div>}
            {patient && <button className="ws-button ws-full" data-testid="share-record" disabled={!documents.length} onClick={() => openModal("share")}><ShieldCheck size={16} />Share a record</button>}
          </Card>}{patient && <Card title="Consent & access">{!shares.length ? <p className="ws-padded ws-muted">No documents are shared. You control who can access each record.</p> : shares.map(s => <div className="ws-share" key={s.id}><strong>{s.recipient_name}</strong><p>{s.revoked_at ? "Access revoked" : `Expires ${dateLabel(s.expires_at)}`}</p>{!s.revoked_at && <button className="ws-text-button" data-testid={`revoke-${s.id}`} onClick={() => perform(async () => { if (!demo) await api("/workspace/documents", { action: "revoke", shareId: s.id }); setShares(rows => rows.map(row => row.id === s.id ? { ...row, revoked_at: new Date().toISOString() } : row)); }, "Access revoked. Existing download links expire within 60 seconds.")}>Revoke access</button>}</div>)}</Card>}{taskPanel}</div></div>}
          {view === "messages" && <Card title="Secure conversations"><ItemList items={filtered(data.messages)} onOpen={openItem} empty="Your secure inbox is ready" /><p className="ws-padded ws-muted">Keep health details in your secure conversation, not email or push notifications.</p></Card>}
          {view === "payments" && <Card title="Payments & receipts" action={<button data-testid="open-dispute" className="ws-button" onClick={() => openModal("dispute")} disabled={!data.payments.length || !data.extensionsReady}>Raise a dispute</button>}><DataTable items={filtered(data.payments)} onOpen={openItem} heading="Payment" /></Card>}
          {view === "insights" && <div className="ws-detail-grid"><div>{patient && trendPanel}<Card title="Your next steps"><ItemList items={filtered(data.insights)} onOpen={openItem} /><p className="ws-padded ws-muted">These reminders support your care plan. They are not diagnoses or medical advice.</p></Card>{doctor && <Card title="Clinical assistance"><p className="ws-padded">Review AI-assisted summaries in the existing clinical review workflow. AI output remains a draft until a clinician approves it.</p><div className="ws-action-row"><button className="ws-button" onClick={() => demo ? openModal("ai") : navigate("/doctor/ai-tools")}><Sparkles size={16} />Open AI review</button><button className="ws-button" onClick={() => openModal("template")}>Consultation templates</button></div></Card>}</div><Card title={patient ? "Connected health data" : "Operational intelligence"}><div className="ws-padded"><Activity size={28} /><h3>{patient ? "Bring your daily picture into focus" : "Better decisions start with context"}</h3><p className="ws-muted">{patient ? "Import your wearable readings as JSON. Sharing requires your explicit consent. Data is informational, not a medical-device measurement." : "Attendance reminder priorities use transparent rules, not a validated predictive model. Never use them to deny care or double-book."}</p><button className="ws-button" data-testid="advanced-intelligence" onClick={() => openModal(patient ? "wearable" : "risk")}>{patient ? "Import wearable data" : "Review attendance signals"}<ArrowUpRight size={16} /></button></div></Card></div>}
          {view === "operations" && <div className="ws-detail-grid"><div><Card title={admin ? "Provider verification & platform queue" : facility ? "Service catalogue" : "Documentation & earnings"}><DataTable items={filtered(data.operations)} onOpen={openItem} heading={admin ? "Account" : "Details"} /></Card><Card title="Disputes"><DataTable items={operations.disputes.map(d => ({ id: d.id, title: `Payment ${d.payment_id}`, subtitle: d.reason, status: d.status, at: d.created_at }))} onOpen={item => { setSelected(item); openModal(admin ? "resolve" : "detail"); }} /></Card>{facility && <Card title="Staff & room workload"><DataTable items={operations.resources.map(r => ({ id: r.id, title: r.name, subtitle: `${r.kind} · ${r.assignments} assignments · ${Number(r.booked_hours).toFixed(1)} booked hours`, status: r.active ? "Active" : "Inactive" }))} onOpen={item => { setSelected(item); openModal("assign"); }} /></Card>}</div><div><Card title="Workspace controls"><div className="ws-controls">{admin ? <><button className="ws-button" onClick={() => openModal("subscription")}>Manage subscription</button><button className="ws-button" onClick={() => openModal("refund")}>Review a refund</button><button className="ws-button" data-testid="audit-export" onClick={() => demo ? saveCsv("medic1905-audit-demo.csv", [["Action", "Actor"], ["WORKSPACE_READ", "ADMIN"]]) : navigate("/api/workspace/export")}><ArrowDownToLine size={16} />Export audit log</button><button className="ws-button" onClick={() => demo ? openModal("experiments") : perform(async () => { const rows = await api<Record<string, unknown>[]>("/workspace/experiments"); saveCsv("medic1905-experiments.csv", [["Experiment", "Variant", "Event", "Users"], ...rows.map(r => [r.experiment, r.variant, r.event, r.users])]); })}>A/B experiment report</button></> : facility ? <><button className="ws-button" onClick={() => openModal("resource")}>Add staff or room</button><button className="ws-button" onClick={() => demo ? openModal("detail") : navigate("/lab/services")}>Manage services</button></> : <><button className="ws-button" onClick={() => openModal("template")}>Consultation templates</button><button className="ws-button" onClick={() => openModal("followup")}>Schedule a follow-up</button><button className="ws-button" onClick={() => demo ? openModal("availability") : navigate("/doctor/schedule")}>Manage availability</button></>}</div></Card><Card title="Subscription status"><div className="ws-padded"><StatusChip tone={data.subscription.includes("Active") ? "green" : "neutral"}>{data.subscription}</StatusChip><p className="ws-muted">Subscription records are managed by your administrator. This does not initiate a charge.</p>{operations.subscriptions.map(s => <p key={s.id}>{s.name ?? s.plan}: {s.status}</p>)}</div></Card>{taskPanel}</div></div>}
          {view === "settings" && <Card title="Privacy & preferences"><div className="ws-settings"><ShieldCheck size={30} /><h3>You are in control of your care.</h3><p>Record access is explicit, time-limited and revocable. Email and push updates never contain clinical details.</p><div className="ws-action-row"><button className="ws-button" data-testid="settings-theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={17} /> : <Moon size={17} />}Switch to {dark ? "light" : "dark"}</button><button className="ws-button" onClick={() => demo ? openModal("preferences") : navigate("/profile")}>Notification preferences</button><button className="ws-button" onClick={() => openModal("push")}>Enable push notifications</button>{patient && <button className="ws-button" onClick={() => changeView("records")}>Manage record consent</button>}</div></div></Card>}
        </>}
        <footer className="ws-footer"><span><ShieldCheck size={14} />Private by design. Connected by care.</span><span>Updated {new Date(data.updatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}<button data-testid="refresh-data" onClick={() => perform(async () => { if (!demo) setData(await api<WorkspaceData>("/workspace")); else setData(d => ({ ...d, updatedAt: new Date().toISOString() })); }, "Workspace refreshed")}>Refresh</button></span></footer>
        {view === "insights" && patient && wearables.length > 0 && <Card title="Imported wearable readings">
          <DataTable items={wearables.slice(0, 30).map((r, i) => ({ id: `wearable-${i}`, title: r.metric.replace(/_/g, " "), subtitle: `${r.value} · ${r.source}`, status: "Self-reported", at: r.recorded_at }))} onOpen={openItem} heading="Reading" />
        </Card>}
      </main>
    </div>
    {modal && <Modal title={{ task: "Add a care task", notifications: "Notification centre", detail: selected?.title ?? "Workspace details", book: "Make time for your health", intake: "Prepare for your visit", upload: "Upload a health record", share: "Share a record securely", template: "Consultation documentation", wearable: "Import wearable readings", dispute: "Raise a payment dispute", subscription: "Manage subscription", refund: "Review & request a refund", resource: "Add a staff member or room", resolve: "Review payment dispute", assign: "Assign a facility resource", followup: "Schedule follow-up automation", risk: "Attendance reminder priority", ai: "Clinical AI review", push: "Enable push notifications" }[modal] ?? "Workspace settings"} onClose={() => { setModal(null); setSelected(null); }}>
      {modal === "task" && <form onSubmit={addTask}><label>Task title<input name="title" data-testid="task-title" maxLength={160} required placeholder="What needs your attention?" autoFocus /></label>{doctor && <label>Task type<select name="kind"><option value="NOTE">Clinical note</option><option value="PRESCRIPTION">Prescription</option><option value="REFERRAL">Referral</option><option value="RESULT_REVIEW">Result review</option><option value="CARE">Care task</option></select></label>}<button data-testid="save-task" className="ws-button ws-primary" disabled={busy}>Add task</button></form>}
      {modal === "notifications" && <><div className="ws-notification-heading"><p>{unread ? `${unread} unread updates` : "You're all caught up"}</p><button className="ws-text-button" data-testid="mark-notifications-read" disabled={busy || !unread} onClick={markRead}>Mark all as read</button></div><ItemList items={data.notifications} onOpen={item => { setSelected(item); setModal("detail"); }} /></>}
      {modal === "detail" && selected && <><StatusChip tone={selected.tone}>{selected.status}</StatusChip><p className="ws-modal-description">{selected.subtitle}</p>{selected.at && <p className="ws-muted">{dateLabel(selected.at)} · {timeLabel(selected.at)} WAT</p>}{selected.caseNumber && <p className="ws-muted">Case {selected.caseNumber}</p>}{selected.href && !demo ? <a className="ws-button ws-primary" href={selected.href}>Continue in secure workspace <ArrowUpRight size={16} /></a> : demo ? <div className="ws-preview-note"><LockKeyhole size={18} /><p>This is a synthetic record. Live consultations, payments and messages open in the authenticated app.</p></div> : null}</>}
      {modal === "book" && <><p className="ws-modal-description">Find a verified doctor, choose an available slot, and review the fee before booking.</p><div className="ws-book-options">{["General practice", "Cardiology", "Women's health"].map((s, i) => <button key={s} data-testid={`book-specialty-${i}`} onClick={() => { if (!demo) navigate("/doctors"); else { setInline(`${s} selected. Booking and payment require the authenticated app.`); } }}><Heart size={19} /><span>{s}</span><ArrowUpRight size={17} /></button>)}</div><p className="ws-muted">Appointments are confirmed through your care team. No charge is initiated here.</p></>}
      {modal === "intake" && <form onSubmit={submitIntake}><label>Appointment<select name="appointment" required>{data.appointments.map(a => <option key={a.id} value={a.id}>{a.title} · {dateLabel(a.at)}</option>)}</select></label><label>What would you like to discuss?<textarea name="reason" required maxLength={3000} data-testid="intake-reason" /></label><label>Current medications<textarea name="medications" maxLength={3000} /></label><label>Allergies<textarea name="allergies" maxLength={3000} /></label><label className="ws-consent"><input type="checkbox" required data-testid="intake-consent" />I agree to share these details with my treating clinician.</label><button className="ws-button ws-primary" data-testid="save-intake" disabled={busy || !data.appointments.length}>Save intake</button></form>}
      {modal === "upload" && <form onSubmit={uploadDocument}><label className="ws-dropzone"><Upload size={30} /><strong>Select your health record</strong><span>PDF, PNG, JPEG or WebP · Up to 15 MB</span><input data-testid="document-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" required onChange={e => setUploaded(e.target.files?.[0] ?? null)} /></label>{uploaded && <p>{uploaded.name} · {Math.ceil(uploaded.size / 1024)} KB</p>}<p className="ws-muted">Your record stays private until you explicitly share it.</p><button className="ws-button ws-primary" data-testid="confirm-upload" disabled={busy || !uploaded}>{busy ? "Verifying upload..." : demo ? "Add to preview" : "Upload securely"}</button></form>}
      {modal === "share" && <form onSubmit={shareDocument}><label>Document<select name="document" required>{documents.map(d => <option key={d.id} value={d.id}>{d.file_name}</option>)}</select></label><label>Verified doctor<select name="doctor" required>{!shareDoctors.length && <option value="">No verified doctors available</option>}{shareDoctors.map(d => <option key={d.id} value={d.id}>{d.name}{d.specialty ? ` · ${d.specialty}` : ""}</option>)}</select></label><label>Access duration<select name="days"><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option></select></label><label className="ws-consent"><input type="checkbox" data-testid="share-consent" required />I consent to sharing this specific document with this doctor.</label><p className="ws-muted">You can revoke access at any time. Download links already issued expire within 60 seconds.</p><button className="ws-button ws-primary" data-testid="confirm-share" disabled={busy || !shareDoctors.length}>Grant access</button></form>}
      {modal === "template" && <><label>Documentation template<select data-testid="consultation-template" value={template} onChange={e => { const t = e.target.value as keyof typeof consultationTemplates; setTemplate(t); setNote(consultationTemplates[t]); }}><option value="SOAP">SOAP consultation</option><option value="FollowUp">Follow-up review</option></select></label><label>Consultation draft<textarea data-testid="consultation-note" rows={12} value={note} onChange={e => setNote(e.target.value)} /></label><p className="ws-muted">Select the patient and ICD-10 code in the secure consultation workflow before finalizing. This draft is not a prescription.</p><div className="ws-action-row"><button className="ws-button" data-testid="download-template" onClick={() => saveCsv("medic1905-consultation-draft.csv", [["Template", "Draft"], [template, note]])}>Export draft</button><button className="ws-button ws-primary" onClick={() => demo ? setInline("Draft ready. Live patient selection and ICD-10 search require the authenticated app.") : navigate("/doctor/consultations")}>Open consultation workflow</button></div></>}
      {modal === "wearable" && <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); perform(async () => {
        const b = wearableImportSchema.parse({ source: String(f.get("source")), readings: JSON.parse(String(f.get("readings"))), consent: true });
        if (!demo) await api("/workspace/wearables", b);
        setWearables(rows => [...b.readings.map(r => ({ metric: r.metric, value: r.value, recorded_at: r.recordedAt, source: b.source })), ...rows]); setModal(null);
      }, demo ? "Demo wearable import validated for this session" : "Wearable readings imported"); }}><label>Data source<input name="source" maxLength={80} required defaultValue="Wearable export" /></label><label>Readings (JSON)<textarea name="readings" data-testid="wearable-json" rows={7} required defaultValue={JSON.stringify([{ metric: "steps", value: 6500, recordedAt: new Date().toISOString() }], null, 2)} /></label><p className="ws-muted">Supported metrics: steps, resting_heart_rate and sleep_hours. Use metric, value and recordedAt fields.</p><label className="ws-consent"><input type="checkbox" required />I consent to storing these readings in my private health account.</label><button className="ws-button ws-primary" disabled={busy}>Import readings</button></form>}
      {["dispute", "subscription", "refund", "resource", "resolve", "assign"].includes(modal) && <form onSubmit={operationAction}>
        <input name="action" type="hidden" value={modal} />
        {modal === "dispute" && <><label>Payment<select name="paymentId" required>{data.payments.map(p => <option key={p.id} value={p.id}>{p.title} · {p.subtitle}</option>)}</select></label><label>What happened?<textarea name="reason" required minLength={10} maxLength={2000} /></label></>}
        {modal === "subscription" && <><label>Account ID<input name="ownerId" required placeholder="User UUID" /></label><label>Plan name<input name="plan" required maxLength={80} /></label><label>Status<select name="status"><option>ACTIVE</option><option>PAUSED</option><option>CANCELLED</option></select></label><p className="ws-muted">This updates the operational subscription record. It does not charge a payment method.</p></>}
        {modal === "refund" && <><label>Successful payment ID<input name="paymentId" required placeholder="Payment UUID" /></label><label>Reason for full refund<textarea name="reason" required minLength={10} maxLength={2000} /></label><label className="ws-consent"><input type="checkbox" required />I confirm this full refund should be submitted to the payment provider.</label><p className="ws-muted">The request may remain pending until confirmed by the gateway. Refunding does not resolve a dispute automatically.</p></>}
        {modal === "resource" && <><label>Resource type<select name="kind"><option value="STAFF">Staff member</option><option value="ROOM">Room</option></select></label><label>Name<input name="name" required maxLength={100} /></label><label>Concurrent capacity<input name="capacity" type="number" min="1" max="100" defaultValue="1" required /></label></>}
        {modal === "resolve" && <><input name="id" type="hidden" value={selected?.id} /><label>Status<select name="status"><option>REVIEWING</option><option>RESOLVED</option></select></label><label>Resolution note<textarea name="resolution" minLength={5} maxLength={2000} required /></label></>}
        {modal === "assign" && <><input name="resourceId" type="hidden" value={selected?.id} /><label>Booking<select name="bookingId">{data.appointments.map(a => <option key={a.id} value={a.id}>{a.title} · {a.subtitle}</option>)}</select></label><label>Start (ISO date-time)<input name="startsAt" placeholder="2026-10-16T10:00:00Z" required /></label><label>End (ISO date-time)<input name="endsAt" placeholder="2026-10-16T11:00:00Z" required /></label></>}
        <button className="ws-button ws-primary" data-testid="save-operation" disabled={busy}>{modal === "refund" ? "Submit full refund request" : "Save"}</button>
      </form>}
      {modal === "followup" && <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); perform(async () => { if (!demo) await api("/workspace/followups", { consultationId: String(f.get("id")), dueAt: new Date(String(f.get("due"))).toISOString() }); setModal(null); }, "Follow-up reminder scheduled"); }}><label>Consultation ID<input name="id" required placeholder="Consultation UUID" /></label><label>Send reminder on<input type="datetime-local" name="due" required min={new Date().toISOString().slice(0, 16)} /></label><p className="ws-muted">Only schedule clinician-approved follow-up. Delivery depends on the scheduler and the notification preferences of the patient.</p><button className="ws-button ws-primary" disabled={busy}>Schedule reminder</button></form>}
      {modal === "risk" && <><StatusChip tone="amber">Decision support only</StatusChip><p className="ws-modal-description">Review appointments with a previous no-show, a booking lead time over 14 days, or an unconfirmed slot. Two or more signals suggest a reminder-priority review.</p><p className="ws-muted">This is a transparent heuristic, not a validated risk probability. Review individual context; never deny care, automatically cancel or double-book.</p></>}
      {modal === "ai" && <><Sparkles size={28} /><p className="ws-modal-description">AI-assisted summaries and documentation are available only to verified doctors in the clinical workflow. Draft output must be reviewed before use.</p><p className="ws-muted">The preview does not send health data to an AI service.</p></>}
      {modal === "availability" && <><p className="ws-modal-description">{data.availability}</p><p className="ws-muted">Live scheduling uses published clinic-local windows and checks for overlapping appointments before booking.</p></>}
      {modal === "preferences" && <p className="ws-modal-description">Manage appointment, result, message and payment alerts separately for in-app, email and push channels in your authenticated profile.</p>}
      {modal === "experiments" && <><p className="ws-modal-description">The extension includes deterministic A/B assignment and consented engagement event storage.</p><p className="ws-muted">The existing homepage is unchanged. Homepage experiments require an explicitly approved integration.</p></>}
      {modal === "push" && <><p className="ws-modal-description">Receive generic account updates on this device. Clinical details will stay inside your secure account.</p><button className="ws-button ws-primary" disabled={busy} onClick={() => perform(async () => {
        if (demo) throw new Error("Push is available only on the authenticated app's own HTTPS origin.");
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("This browser does not support web push.");
        const { vapidPublicKey } = await api<{ vapidPublicKey: string | null }>("/notifications/preferences");
        if (!vapidPublicKey) throw new Error("Push notifications are not configured by the operator.");
        const permission = await Notification.requestPermission();
        if (permission !== "granted") throw new Error("Notification permission was not granted.");
        await navigator.serviceWorker.register("/workspace-push.js", { scope: "/workspace" });
        const registration = await navigator.serviceWorker.ready;
        const subscription = await subscribeWithVapidKey(registration, vapidPublicKey);
        await api("/notifications/push-subscription", subscription.toJSON());
        setModal(null);
      }, "Push notifications enabled")}>Enable on this device</button></>}
      {inline && <p role="status" className="ws-inline-feedback">{inline}</p>}
    </Modal>}
    {toast && <Toast message={toast.text} tone={toast.error ? "red" : "green"} onClose={closeToast} />}
  </div>;
}
