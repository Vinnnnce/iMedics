"use client";

import { useState } from "react";
import { Activity, BrainCircuit, Building2, FileHeart, FlaskConical, HeartPulse, Pill, ScanLine, Stethoscope, Users, Pause, Play } from "lucide-react";

const nodes = [
  { label: "Doctors", Icon: Stethoscope, x: 24, y: 18 },
  { label: "Patients", Icon: Users, x: 73, y: 16 },
  { label: "Hospitals", Icon: Building2, x: 12, y: 46 },
  { label: "Laboratories", Icon: FlaskConical, x: 87, y: 44 },
  { label: "Diagnostics", Icon: ScanLine, x: 23, y: 77 },
  { label: "Pharmacies", Icon: Pill, x: 76, y: 76 },
  { label: "Nursing", Icon: HeartPulse, x: 49, y: 91 },
  { label: "Records", Icon: FileHeart, x: 49, y: 5 },
];

/** Decorative geometry only: no real records or diagnostic claims. */
export function HealthcareAnimation() {
  const [paused, setPaused] = useState(false);
  return (
    <div className="health-network" data-paused={paused}>
      <div className="health-network-diagram" role="img" aria-label="Doctors, patients, hospitals, laboratories, diagnostics, pharmacies, nursing and records connected through healthcare intelligence">
        <svg viewBox="0 0 100 100" aria-hidden="true" className="health-connections">
          {nodes.map(({ label, x, y }, i) => (
            <path key={label} d={`M50 49 Q${x} 49 ${x} ${y}`} className="health-data-path" style={{ animationDelay: `${i * -.6}s` }} />
          ))}
          <path d="M0 49 H30 L35 44 L40 58 L46 33 L52 57 L57 49 H100" className="health-pulse" />
        </svg>
        <div className="health-core"><BrainCircuit aria-hidden="true" /><span>Connected care</span></div>
        {nodes.map(({ label, Icon, x, y }) => (
          <div key={label} className="health-node" style={{ left: `${x}%`, top: `${y}%` }}>
            <Icon aria-hidden="true" /><span>{label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-4 text-xs">
        <span className="flex items-center gap-2"><Activity className="size-4" aria-hidden="true" /> One connected healthcare ecosystem</span>
        <button type="button" className="health-motion-button" onClick={() => setPaused(!paused)} aria-label={paused ? "Play healthcare animation" : "Pause healthcare animation"}>
          {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
        </button>
      </div>
    </div>
  );
}
