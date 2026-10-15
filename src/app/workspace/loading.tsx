export default function WorkspaceLoading() {
  return <section aria-busy="true" aria-label="Loading your care workspace" className="p-8"><h1 className="text-xl font-semibold">Preparing your workspace</h1><p className="mt-2 text-muted-foreground">Loading your appointments, tasks and notifications.</p><div className="mt-8 grid gap-4 md:grid-cols-4">{[1,2,3,4].map(n => <div key={n} className="h-28 animate-pulse rounded-xl bg-muted" />)}</div></section>;
}
