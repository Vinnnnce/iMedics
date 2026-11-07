/**
 * Flat line-art illustrations for the emergency learning centre.
 * One consistent style: 96x96 viewBox, 2.5px round strokes in currentColor,
 * with destructive-red accents for anything urgent (hearts, lightning, alerts).
 * Inline SVG only — no external assets, works in light and dark themes.
 */
import type { ReactNode } from "react";

const ILLUSTRATIONS: Record<string, ReactNode> = {
  // Original schematic extensions to the existing project illustration set.
  // Recognition/equipment only: not procedural medical demonstrations.
  bleeding: <><path d="M12 63h72v14H12z" /><rect x="37" y="58" width="23" height="23" rx="2" /><path d="M48 13v31m-8-8 8 8 8-8" className="text-destructive" /><path d="M37 66h23m-23 7h23" /></>,
  stroke: <><circle cx="33" cy="30" r="16" /><path d="M26 28h1m12 0h1m-15 11 9-2 8 6M15 72V60l18-10 19 10 14 10" /><path className="text-destructive" d="M60 16h25v25H70l-7 8V41h-3zM66 24h12m-12 8h9" /></>,
  "heart-attack": <><path d="M47 74 16 46C-2 24 27 5 47 27 67 5 96 24 78 46Z" /><path className="text-destructive" d="M48 36v20m0 7v1" /></>,
  choking: <><circle cx="29" cy="24" r="12" /><path d="M12 76V53q17-18 34 0v23M12 65l12-23m22 23L34 42" /><circle cx="73" cy="48" r="9" /><rect x="61" y="61" width="24" height="19" rx="8" /><path className="text-destructive" d="M52 21v49" /></>,
  "road-safety": <><path className="text-destructive" d="m8 59 18-33 18 33zM26 40v8m0 4v1" /><path d="M47 66V49h8l10-16h15l10 16v17zM5 83h86" /><circle cx="57" cy="69" r="6" /><circle cx="80" cy="69" r="6" /></>,
  burns: <><path d="M14 15h25v13h20v13H28V28H14zM10 73h74v12H10z" /><path className="text-destructive" d="M44 49v15m10-15v15m10-15v15" strokeDasharray="3 4" /></>,
  ambulance: <><path d="M9 68V29h47v13h19l12 15v20H9z" /><path d="M63 49h9l8 10H63zM31 22h13" /><circle cx="27" cy="77" r="9" /><circle cx="71" cy="77" r="9" /><path className="text-destructive" d="m35 39-5 12 10-3-5 12" /></>,
  // Recognising cardiac arrest — collapsed person with an alert above.
  "recognise-arrest": (
    <>
      <circle cx="26" cy="30" r="7" />
      <path d="M31 36 L44 58 L44 72" />
      <path d="M31 36 L36 52 L50 44" />
      <path d="M44 72 L38 86" />
      <path d="M44 72 L52 86" />
      <path className="text-destructive" d="M68 14 L84 42 L52 42 Z" />
      <path className="text-destructive" d="M68 26 L68 34" />
      <path className="text-destructive" d="M68 37 L68 37.01" />
    </>
  ),
  // Scene safety — shield with a check.
  "scene-safety": (
    <>
      <path d="M48 12 L76 22 V44 C76 62 64 74 48 82 C32 74 20 62 20 44 V22 Z" />
      <path className="text-destructive" d="M36 46 L45 55 L62 36" />
    </>
  ),
  // Check response and breathing — hand hovering over a chest with breath waves.
  "check-response-breathing": (
    <>
      <path d="M24 34 C32 30 40 30 48 34 C56 38 64 38 72 34" />
      <path d="M24 46 C32 42 40 42 48 46 C56 50 64 50 72 46" />
      <path d="M28 62 C38 58 58 58 68 62" />
      <path className="text-destructive" d="M30 70 C40 66 56 66 66 70" />
      <circle cx="48" cy="20" r="4" />
    </>
  ),
  // Activate emergency help — phone with an alert.
  "activate-help": (
    <>
      <rect x="24" y="14" width="36" height="62" rx="6" />
      <path d="M34 20 H50" />
      <path d="M40 70 H44" />
      <path className="text-destructive" d="M70 30 L82 52 H58 Z" />
      <path className="text-destructive" d="M70 39 L70 46" />
      <path className="text-destructive" d="M70 49 L70 49.01" />
    </>
  ),
  // High-quality CPR — two hands on a chest, compression arrows.
  "high-quality-cpr": (
    <>
      <path d="M20 58 C30 50 42 48 52 52 L58 58" />
      <path d="M32 46 L44 46 L52 52 L46 60 L36 58 Z" />
      <path d="M38 66 L50 66" />
      <path className="text-destructive" d="M64 30 V58" />
      <path className="text-destructive" d="M58 36 L64 30 L70 36" />
      <path className="text-destructive" d="M58 52 L64 58 L70 52" />
    </>
  ),
  // Rescue breaths — head profile with airway arrow.
  "rescue-breaths": (
    <>
      <path d="M30 76 C28 60 34 48 46 44 C54 41 60 44 62 50 L58 56 L66 60" />
      <path d="M30 76 L44 80" />
      <circle cx="44" cy="52" r="2" />
      <path d="M52 30 C62 28 70 32 74 40" />
      <path className="text-destructive" d="M68 26 L78 40 L60 42 Z" />
    </>
  ),
  // AED use — defibrillator box with heart and lightning.
  "aed-use": (
    <>
      <rect x="18" y="18" width="60" height="52" rx="8" />
      <path d="M28 30 H48" />
      <path d="M28 38 H40" />
      <path className="text-destructive" d="M52 52 C46 46 42 50 44 56 C45 60 49 62 52 64 C55 62 59 60 60 56 C62 50 58 46 52 52 Z" />
      <path className="text-destructive" d="M74 22 L68 34 H78 L70 48" />
      <path d="M36 74 V84 H60 V74" />
    </>
  ),
  // Continue until handover — circular arrows around a cross.
  "continue-and-handover": (
    <>
      <path d="M48 20 A28 28 0 0 1 76 48" />
      <path d="M76 48 A28 28 0 0 1 48 76" />
      <path d="M48 76 A28 28 0 0 1 20 48" />
      <path d="M20 48 A28 28 0 0 1 44 20" />
      <path d="M76 40 V48 H84" />
      <path d="M44 16 L48 12 L52 16" />
      <path className="text-destructive" d="M42 48 H54 M48 42 V54" />
    </>
  ),
  // ALS concepts — clipboard with a pulse line.
  "als-concepts": (
    <>
      <rect x="26" y="16" width="44" height="64" rx="6" />
      <path d="M40 16 V10 H56 V16" />
      <path className="text-destructive" d="M34 46 L42 46 L46 36 L52 56 L56 46 L62 46" />
      <path d="M34 60 H62" />
      <path d="M34 66 H54" />
    </>
  ),
  // ALS airway — tube and curve into an airway.
  "als-airway": (
    <>
      <path d="M30 20 V64 C30 72 36 78 44 78 C52 78 58 72 58 64" />
      <path d="M24 20 H36" />
      <path d="M52 20 H64" />
      <path className="text-destructive" d="M66 28 C74 34 76 44 72 52" />
      <path className="text-destructive" d="M66 26 L74 26 L72 34" />
    </>
  ),
  // ALS rhythms — ECG traces.
  "als-rhythms": (
    <>
      <path d="M18 40 H34 L38 30 L44 50 L48 40 H60" />
      <path className="text-destructive" d="M60 40 H66 L70 24 L76 56 L80 40 H78" />
      <path d="M18 66 H40 L44 60 L48 72 L52 66 H78" />
      <circle className="text-destructive" cx="30" cy="24" r="3" />
      <path className="text-destructive" d="M22 24 H26 M32 24 H38" />
    </>
  ),
  // ALS defibrillation — pads on a torso with lightning.
  "als-defibrillation": (
    <>
      <path d="M24 26 C36 20 60 20 72 26 L68 44 C60 40 36 40 28 44 Z" />
      <path d="M28 52 C36 60 60 60 68 52" />
      <path d="M34 68 H62" />
      <path className="text-destructive" d="M46 30 L40 44 H50 L42 58" />
    </>
  ),
  // ALS reversible causes — heart surrounded by the causes.
  "als-reversible-causes": (
    <>
      <path className="text-destructive" d="M48 64 C34 54 28 46 30 38 C32 30 42 28 48 36 C54 28 64 30 66 38 C68 46 62 54 48 64 Z" />
      <circle cx="24" cy="24" r="6" />
      <circle cx="72" cy="24" r="6" />
      <circle cx="24" cy="72" r="6" />
      <circle cx="72" cy="72" r="6" />
    </>
  ),
  // Post-resuscitation care — bed with a monitor.
  "als-post-resuscitation": (
    <>
      <path d="M16 56 H80" />
      <path d="M16 56 V40" />
      <path d="M80 56 V44" />
      <path d="M22 56 V70 M74 56 V70" />
      <path d="M24 48 H44 L48 42" />
      <rect className="text-destructive" x="54" y="16" width="24" height="18" rx="3" />
      <path className="text-destructive" d="M58 25 H64 L67 21 L70 29 L73 25 H74" />
    </>
  ),
  // Team resuscitation — three people around a bed.
  "als-team": (
    <>
      <circle cx="30" cy="24" r="6" />
      <path d="M22 44 C22 34 38 34 38 44" />
      <circle cx="66" cy="24" r="6" />
      <path d="M58 44 C58 34 74 34 74 44" />
      <circle cx="48" cy="34" r="6" />
      <path d="M16 52 H80" />
      <path d="M20 52 V66 M76 52 V66" />
      <path className="text-destructive" d="M40 46 H56 L52 52 H44 Z" />
    </>
  ),
  // Documentation — record with a check.
  "als-documentation": (
    <>
      <path d="M28 14 H56 L68 26 V78 H28 Z" />
      <path d="M56 14 V26 H68" />
      <path d="M38 38 H58" />
      <path d="M38 46 H58" />
      <path d="M38 54 H50" />
      <path className="text-destructive" d="M42 64 L48 70 L60 56" />
    </>
  ),
};

/** The illustration for an emergency module, keyed by module id. */
export function EmergencyIllustration({
  id,
  className,
  label,
}: {
  id: string;
  className?: string;
  label?: string;
}) {
  const art = ILLUSTRATIONS[id] ?? ILLUSTRATIONS["als-concepts"];
  return (
    <svg
      viewBox="0 0 96 96"
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {label && <title>{label}</title>}
      {art}
    </svg>
  );
}
