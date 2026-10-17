"use client";
export default function WorkspaceError({ reset }: { reset: () => void }) {
  return <section role="alert" className="p-8"><h1 className="text-xl font-semibold">Your workspace is unavailable</h1><p className="mt-2">We could not load your account securely. No sample records have been substituted.</p><button className="mt-5 rounded-lg border px-5 py-3" onClick={reset}>Try again</button></section>;
}
