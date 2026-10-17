"use client";
import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { EmptyState } from "@/components/shared/async-state";
import { StatusChip } from "@/components/shared/status-chip";
import { Panel, useDashboardMutation, apiClient } from "./common";
import type { CareTask, WorkspaceRole } from "@/lib/workspace/types";

export function TaskPanel({ initialTasks, ready, role }: { initialTasks: CareTask[]; ready: boolean; role: WorkspaceRole }) {
  const [tasks, setTasks] = useState(initialTasks), [filter, setFilter] = useState("all");
  const mutation = useDashboardMutation();
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, fields = new FormData(form);
    await mutation.run(async () => {
      const title = String(fields.get("title")).trim(), kind = String(fields.get("kind") || "CARE");
      const due = String(fields.get("due") || "");
      const { id } = await apiClient.post<{ id: string }>("/workspace/tasks", { title, kind, ...(due ? { dueAt: new Date(due).toISOString() } : {}) });
      setTasks(rows => [...rows, { id, title, kind, completed: false, status: "To do", subtitle: due ? new Date(due).toLocaleString() : "No due date" }]); form.reset();
    }, "Task created");
  }
  return <Panel title={role === "DOCTOR" ? "Clinical task queue" : "Care tasks"}>
    {!ready && <p role="status" className="text-sm text-muted-foreground">Tasks are unavailable until the existing workspace database migration is installed.</p>}
    {mutation.errorUI}
    <label className="block space-y-2 text-sm">Filter tasks<select aria-label="Filter tasks" className="block h-10 w-full rounded-lg border border-input bg-background px-2" value={filter} onChange={e => setFilter(e.target.value)}>
      <option value="all">All tasks</option><option value="open">Open</option><option value="complete">Completed</option>{role === "DOCTOR" && ["NOTE", "PRESCRIPTION", "REFERRAL", "RESULT_REVIEW"].map(kind => <option key={kind} value={kind}>{kind.replace(/_/g, " ")}</option>)}
    </select></label>
    {!tasks.length && <EmptyState title="No care tasks yet" detail="Add a task to keep your next steps organized." />}
    <ul className="space-y-3">{tasks.filter(task => filter === "all" || (filter === "open" ? !task.completed : filter === "complete" ? task.completed : task.kind === filter)).map(task => <li key={task.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
      <input className="mt-1 h-4 w-4" type="checkbox" aria-label={`Complete ${task.title}`} checked={task.completed} disabled={mutation.busy || !ready}
        onChange={() => void mutation.run(async () => {
          await apiClient.patch("/workspace/tasks", { id: task.id, completed: !task.completed });
          setTasks(rows => rows.map(row => row.id === task.id ? { ...row, completed: !row.completed } : row));
        }, task.completed ? "Task reopened" : "Task completed")} />
      <div className="min-w-0 flex-1"><p className={task.completed ? "text-sm line-through" : "text-sm font-medium"}>{task.title}</p><p className="text-xs text-muted-foreground">{task.subtitle}</p></div>
      <StatusChip>{task.kind.replace(/_/g, " ")}</StatusChip>
    </li>)}</ul>
    <form className="space-y-3 border-t border-border pt-4" onSubmit={add}>
      <FormField label="New task" required><Input name="title" required maxLength={160} disabled={!ready || mutation.busy} /></FormField>
      {role === "DOCTOR" && <label className="block space-y-2 text-sm">Task type<select name="kind" className="block h-10 w-full rounded-lg border border-input bg-background px-2">{["NOTE", "PRESCRIPTION", "REFERRAL", "RESULT_REVIEW", "CARE"].map(kind => <option key={kind}>{kind}</option>)}</select></label>}
      <FormField label="Due date (your device time)"><Input name="due" type="datetime-local" /></FormField>
      <Button type="submit" variant="outline" disabled={!ready || mutation.busy}>{mutation.busy ? "Saving…" : "Add task"}</Button>
    </form>
  </Panel>;
}
