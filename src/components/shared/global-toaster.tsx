"use client";
import { Toaster } from "sonner";
import { useTheme } from "@/components/theme-provider";
export function GlobalToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="top-right" richColors closeButton
    toastOptions={{ className: "border-border bg-card text-card-foreground" }} />;
}
