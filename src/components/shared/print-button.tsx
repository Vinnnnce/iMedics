"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Print receipt" }: { label?: string }) {
  return (
    <Button variant="outline" size="sm" className="rounded-lg print:hidden" onClick={() => window.print()}>
      <Printer className="mr-1 h-4 w-4" /> {label}
    </Button>
  );
}
