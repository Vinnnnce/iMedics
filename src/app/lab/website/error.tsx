"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function WebsiteError({ reset }: { reset: () => void }) {
  return <div className="mx-auto max-w-xl space-y-4 p-6">
    <h1 className="text-xl font-bold">Cannot open your facility website</h1>
    <p role="alert">Select the correct facility and check that your active staff role allows profile management. If you have access, retry or contact your facility administrator.</p>
    <Button onClick={reset}>Retry website</Button>
    <Link href="/lab/dashboard" className="block underline">Back to dashboard</Link>
  </div>;
}
