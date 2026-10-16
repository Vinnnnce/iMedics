"use client";
import { cloneElement, useId, type AriaAttributes, type ReactElement } from "react";
import { Label } from "@/components/ui/label";
interface ControlProps extends Pick<AriaAttributes, "aria-invalid" | "aria-describedby"> { id?: string; required?: boolean }
export function FormField({ label, hint, error, required, children }: {
  label: string; hint?: string; error?: string; required?: boolean; children: ReactElement<ControlProps>;
}) {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  const describedBy = [children.props["aria-describedby"], hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return <div className="space-y-2">
    <Label htmlFor={id}>{label}{required && <span className="text-muted-foreground"> (required)</span>}</Label>
    {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
    {cloneElement(children, { id, required: required ?? children.props.required, "aria-invalid": error ? true : children.props["aria-invalid"], "aria-describedby": describedBy })}
    {error && <p id={`${id}-error`} role="alert" className="text-sm text-foreground">{error}</p>}
  </div>;
}
