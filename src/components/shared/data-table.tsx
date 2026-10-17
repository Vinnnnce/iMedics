"use client";
import type { Key, ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "./async-state";
export interface DataColumn<T> { id: string; header: string; cell: (row: T) => ReactNode; sortable?: boolean }
export function DataTable<T>({ rows, columns, rowKey, caption, loading, error, onRetry, sort, onSort, page = 1, hasNext, onPageChange }: {
  rows: readonly T[]; columns: readonly DataColumn<T>[]; rowKey: (row: T) => Key; caption: string;
  loading?: boolean; error?: string; onRetry?: () => void;
  sort?: { id: string; direction: "asc" | "desc" }; onSort?: (sort: { id: string; direction: "asc" | "desc" }) => void;
  page?: number; hasNext?: boolean; onPageChange?: (page: number) => void;
}) {
  if (loading) return <div role="status" aria-label={`Loading ${caption}`} className="space-y-3"><span className="sr-only">Loading…</span>{[0, 1, 2].map(index => <Skeleton key={index} className="h-12 w-full" />)}</div>;
  if (error) return <ErrorState detail={error} action={onRetry && <Button variant="outline" onClick={onRetry}>Try again</Button>} />;
  if (!rows.length) return <EmptyState title="No matching records" detail="Try another filter or check back when there is new activity." />;
  return <div className="space-y-3">
    <div role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-sm"><caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/50"><tr>{columns.map(column => {
          const selected = sort?.id === column.id;
          const Icon = selected ? sort.direction === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
          return <th key={column.id} scope="col" className="whitespace-nowrap px-4 py-3 font-medium" aria-sort={selected ? sort.direction === "asc" ? "ascending" : "descending" : undefined}>
            {column.sortable && onSort ? <button type="button" className="inline-flex items-center gap-2 rounded-sm" onClick={() => onSort({ id: column.id, direction: selected && sort.direction === "asc" ? "desc" : "asc" })}>
              {column.header}<Icon aria-hidden="true" className="h-3 w-3" /><span className="sr-only">, sort {selected && sort.direction === "asc" ? "descending" : "ascending"}</span>
            </button> : column.header}
          </th>;
        })}</tr></thead>
        <tbody>{rows.map(row => <tr key={rowKey(row)} className="border-t border-border">{columns.map(column => <td key={column.id} className="px-4 py-3 align-top">{column.cell(row)}</td>)}</tr>)}</tbody>
      </table>
    </div>
    {onPageChange && <nav aria-label={`${caption} pages`} className="flex items-center justify-between gap-3">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
      <span aria-live="polite" className="text-xs text-muted-foreground">Page {page}</span>
      <Button variant="outline" size="sm" disabled={!hasNext} onClick={() => onPageChange(page + 1)}>Next</Button>
    </nav>}
  </div>;
}
