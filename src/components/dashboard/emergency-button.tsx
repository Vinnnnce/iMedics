"use client";

import { useState } from "react";
import Link from "next/link";
import { Siren, PhoneCall, Building2, FileText } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EMERGENCY_NUMBERS } from "@/lib/home/content";

/**
 * Emergency guidance button. Shows national emergency numbers and safe next
 * steps without exposing any clinical data, so it is safe on any screen state.
 */
export function EmergencyButton() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-destructive/40 text-destructive gap-2">
          <Siren aria-hidden="true" className="h-4 w-4" />
          Emergency
          <span className="sr-only">Open emergency guidance</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Siren aria-hidden="true" className="h-5 w-5 text-destructive" />
            Emergency guidance
          </DialogTitle>
          <DialogDescription>
            If you think you are having a medical emergency, act first — do not wait for an online consultation.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <PhoneCall aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
            <span>
              Call <strong>{EMERGENCY_NUMBERS.national}</strong> (national emergency) or{" "}
              <strong>{EMERGENCY_NUMBERS.lagos}</strong> (Lagos emergency services) now.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <Building2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
            <span>Go to the nearest hospital or urgent care centre if you can travel safely.</span>
          </li>
          <li className="flex items-start gap-3">
            <FileText aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
            <span>
              Take your emergency information with you:{" "}
              <Link href="/patient/case-file" className="underline" onClick={() => setOpen(false)}>
                open my health record
              </Link>{" "}
              to show allergies, medications, and blood group to responders.
            </span>
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Medic1905 is a platform, not an emergency service. Consultations are not a substitute for emergency care.
        </p>
      </DialogContent>
    </Dialog>
  );
}