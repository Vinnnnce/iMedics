"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";

type Status = "CONFIRMED" | "CANCELLED" | "IN_PROGRESS" | "COMPLETED" | "NO_SHOW";

interface Props {
  appointmentId: string;
  /** API collection to PATCH. Facility bookings use "/facility-bookings". */
  basePath?: string;
  /** Extra query string for staff scope, e.g. "?scope=facility". */
  query?: string;
  actions: { label: string; status: Status; primary?: boolean }[];
}

/** Buttons that change an appointment's status, then refresh the server-rendered page. */
export function AppointmentActions({ appointmentId, actions, basePath = "/appointments", query = "" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const run = (status: Status) => {
    setError("");
    startTransition(async () => {
      try {
        await apiClient.patch(`${basePath}/${appointmentId}${query}`, { status });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {actions.map((action) => (
          <Button
            key={action.status}
            size="sm"
            disabled={pending}
            variant={action.primary ? "default" : "outline"}
            className={action.primary ? "bg-foreground text-background rounded-lg" : "rounded-lg"}
            onClick={() => run(action.status)}
          >
            {action.primary ? <Check className="h-4 w-4 mr-1" /> : <X className="h-4 w-4 mr-1" />}
            {action.label}
          </Button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
