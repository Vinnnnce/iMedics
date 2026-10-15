"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight, Check, FolderOpen, X } from "lucide-react";
import type { Tone, Trend, WorkspaceItem } from "@/lib/workspace/types";

export function StatusChip({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`ws-chip ws-${tone}`}><span aria-hidden="true" />{children}</span>;
}
export function Card({ title, eyebrow, action, children, className = "" }: { title?: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`ws-card ${className}`}>{title && <header className="ws-card-heading"><div>{eyebrow && <p className="ws-eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>{action}</header>}{children}</section>;
}
export function EmptyState({ title = "You're all caught up", detail = "New activity will appear here.", action }: { title?: string; detail?: string; action?: ReactNode }) {
  return <div className="ws-empty"><FolderOpen size={26} /><h3>{title}</h3><p>{detail}</p>{action}</div>;
}
export function ItemList({ items, onOpen, empty }: { items: WorkspaceItem[]; onOpen: (item: WorkspaceItem) => void; empty?: string }) {
  if (!items.length) return <EmptyState title={empty} />;
  return <div className="ws-item-list">{items.map((item, i) => <button type="button" data-testid={`open-item-${item.id}`} key={item.id} className="ws-item" onClick={() => onOpen(item)}>
    <span className={`ws-initial ws-initial-${i % 3}`}>{item.title.replace(/^Dr\.\s*/, "").split(" ").slice(0, 2).map(w => w[0]).join("")}</span>
    <span className="ws-item-copy"><strong>{item.title}</strong><span>{item.subtitle}</span></span>
    <span className="ws-item-right"><StatusChip tone={item.tone}>{item.status}</StatusChip><ArrowUpRight size={15} /></span>
  </button>)}</div>;
}
export function DataTable({ items, onOpen, heading = "Details" }: { items: WorkspaceItem[]; onOpen: (item: WorkspaceItem) => void; heading?: string }) {
  if (!items.length) return <EmptyState title="Nothing to show yet" detail="Try a different filter or check back after your next visit." />;
  return <div className="ws-table-wrap"><table className="ws-table"><thead><tr><th>{heading}</th><th>Date</th><th>Status</th><th><span className="ws-sr">Actions</span></th></tr></thead><tbody>{items.map(item => <tr key={item.id}>
    <td><strong>{item.title}</strong><span>{item.subtitle}</span>{item.caseNumber && <small>{item.caseNumber}</small>}</td>
    <td>{item.at ? new Date(item.at).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" }) : "Not scheduled"}</td>
    <td><StatusChip tone={item.tone}>{item.status}</StatusChip></td><td><button data-testid={`table-open-${item.id}`} className="ws-icon-button" onClick={() => onOpen(item)} aria-label={`Open ${item.title}`}><ArrowUpRight size={18} /></button></td>
  </tr>)}</tbody></table></div>;
}
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; d?.showModal(); return () => d?.close(); }, []);
  return <dialog ref={ref} className="ws-dialog" aria-labelledby="ws-modal-title" onCancel={onClose}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], summary, [tabindex="0"]')]
        .filter(element => element.getClientRects().length > 0);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <header><h2 id="ws-modal-title">{title}</h2><button data-testid="close-modal" className="ws-icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></header><div className="ws-dialog-body">{children}</div>
  </dialog>;
}
export function Toast({ message, tone = "green", onClose }: { message: string; tone?: Tone; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [message, onClose]);
  return <div role={tone === "red" ? "alert" : "status"} className={`ws-toast ws-${tone}`}><Check size={18} /><span>{message}</span><button onClick={onClose} aria-label="Dismiss notification"><X size={16} /></button></div>;
}
export function TrendChart({ trend }: { trend: Trend }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio; canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d");
      if (!ctx || !trend.points.length) return;
      ctx.scale(ratio, ratio);
      const w = rect.width, h = rect.height, pad = 25;
      const values = trend.points.map(p => p.value), min = Math.min(...values) - 0.6, max = Math.max(...values) + 0.6;
      const color = getComputedStyle(canvas).color;
      const accent = getComputedStyle(canvas).getPropertyValue("--ws-green").trim() || "#168169";
      ctx.font = "12px sans-serif"; ctx.fillStyle = color; ctx.textAlign = "left";
      for (let i = 0; i < 4; i++) {
        const y = pad + (h - pad * 2) * i / 3;
        ctx.strokeStyle = "rgba(132,154,146,.18)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(32, y); ctx.lineTo(w - 12, y); ctx.stroke();
        ctx.fillText((max - (max - min) * i / 3).toFixed(1), 0, y + 4);
      }
      const x = (i: number) => 40 + i / Math.max(values.length - 1, 1) * (w - 60);
      const y = (v: number) => pad + (max - v) / (max - min) * (h - pad * 2);
      ctx.strokeStyle = accent; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.beginPath();
      values.forEach((v, i) => { if (!i) ctx.moveTo(x(i), y(v)); else ctx.lineTo(x(i), y(v)); }); ctx.stroke();
      values.forEach((v, i) => { ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(x(i), y(v), 4, 0, Math.PI * 2); ctx.fill(); });
    };
    const observer = new ResizeObserver(draw); observer.observe(canvas); draw();
    return () => observer.disconnect();
  }, [trend]);
  return <><canvas ref={ref} className="ws-trend-canvas" role="img" aria-label={`${trend.name} result trend in ${trend.unit}`} /><div className="ws-chart-labels">{trend.points.map(p => <span key={p.date}>{new Date(p.date).toLocaleDateString("en-GB", { month: "short" })}</span>)}</div><details className="ws-chart-data"><summary>View chart data</summary><table><caption>{trend.name} ({trend.unit})</caption><tbody>{trend.points.map(p => <tr key={p.date}><th>{p.date.slice(0, 10)}</th><td>{p.value} {trend.unit}</td></tr>)}</tbody></table></details></>;
}
