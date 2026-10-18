import Link from "next/link";
import { MapPin, Phone, Mail, Clock, CalendarCheck, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { WebsiteLayout } from "@/lib/website/blocks";

/**
 * Renders a facility's published mini-website blocks. Server-side only:
 * the published layout is loaded from the database, never from the client.
 */

export interface RendererFacility {
  id: string;
  laboratoryName: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  operatingHours: string | null;
  logoUrl: string | null;
}

export function FacilityWebsiteRenderer({
  layout,
  facility,
  directory,
  slug,
}: {
  layout: WebsiteLayout;
  facility: RendererFacility;
  directory: string;
  slug: string;
}) {
  const visible = layout.blocks.filter((b) => !b.hidden);
  if (visible.length === 0) return null;

  return (
    <div className="space-y-10">
      {visible.map((block) => {
        const s = block.settings as Record<string, string | undefined>;
        switch (block.type) {
          case "banner":
            return (
              <section key={block.id} aria-labelledby={`w-${block.id}`} className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-foreground/[0.06] to-transparent p-6 md:p-10">
                <h2 id={`w-${block.id}`} className="max-w-2xl text-2xl font-bold md:text-3xl">{s.heading || facility.laboratoryName}</h2>
                {s.subheading && <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">{s.subheading}</p>}
                {s.buttonLabel && (
                  <Link
                    href={s.buttonHref || `/${directory}/${slug}#services`}
                    className="pill-btn pill-btn-primary mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
                  >
                    {s.buttonLabel} <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                )}
              </section>
            );
          case "about":
            return (
              <section key={block.id} aria-labelledby={`w-${block.id}`} className="space-y-3">
                <h2 id={`w-${block.id}`} className="text-lg font-semibold">{s.title || "About us"}</h2>
                {s.body && <p className="whitespace-pre-line text-sm text-muted-foreground">{s.body}</p>}
              </section>
            );
          case "stats": {
            const items = (block.settings as { items?: { label: string; value: string }[] }).items ?? [];
            if (items.length === 0) return null;
            return (
              <section key={block.id} aria-labelledby={`w-${block.id}`} className="space-y-3">
                <h2 id={`w-${block.id}`} className="text-lg font-semibold">{s.title || "Our facility in numbers"}</h2>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {items.map((it, i) => (
                    <Card key={i} className="beeline-card">
                      <CardContent className="p-4">
                        <p className="text-2xl font-bold">{it.value}</p>
                        <p className="text-xs text-muted-foreground">{it.label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            );
          }
          case "departments":
          case "doctors":
          case "services":
          case "diagnostic-tests":
          case "lab-services": {
            const list = (block.settings as { items?: { name: string; description?: string }[] }).items ?? [];
            return (
              <section key={block.id} aria-labelledby={`w-${block.id}`} className="space-y-3">
                <h2 id={`w-${block.id}`} className="text-lg font-semibold">{s.title || "Our services"}</h2>
                {s.body && <p className="text-sm text-muted-foreground">{s.body}</p>}
                {list.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {list.map((it, i) => (
                      <Card key={i} className="beeline-card">
                        <CardContent className="space-y-1 p-4 text-sm">
                          <p className="font-medium">{it.name}</p>
                          {it.description && <p className="text-xs text-muted-foreground">{it.description}</p>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                {(block.type === "doctors" || block.type === "services") && (
                  <p className="text-xs text-muted-foreground">
                    See the <Link className="underline" href={`/${directory}/${slug}#services`}>full service list</Link> and{" "}
                    <Link className="underline" href={`/${directory}/${slug}#team`}>our team</Link> below.
                  </p>
                )}
              </section>
            );
          }
          case "hours": {
            const rows = (block.settings as { rows?: { day: string; hours: string }[] }).rows ?? [];
            return (
              <section key={block.id} aria-labelledby={`w-${block.id}`} className="space-y-3">
                <h2 id={`w-${block.id}`} className="text-lg font-semibold">{s.title || "Opening hours"}</h2>
                {rows.length > 0 ? (
                  <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                    {rows.map((r, i) => (
                      <div key={i} className="flex justify-between gap-4 border-b border-border/60 py-1">
                        <dt className="text-muted-foreground">{r.day}</dt>
                        <dd className="font-medium">{r.hours}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  facility.operatingHours && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock aria-hidden="true" className="h-4 w-4" /> {facility.operatingHours}
                    </p>
                  )
                )}
              </section>
            );
          }
          case "contact":
            return (
              <section key={block.id} aria-labelledby={`w-${block.id}`} className="space-y-3">
                <h2 id={`w-${block.id}`} className="text-lg font-semibold">{s.title || "Contact us"}</h2>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  {(s.phone || facility.phone) && (
                    <span className="flex items-center gap-2"><Phone aria-hidden="true" className="h-4 w-4 text-muted-foreground" />{s.phone || facility.phone}</span>
                  )}
                  {(s.email || facility.email) && (
                    <span className="flex items-center gap-2"><Mail aria-hidden="true" className="h-4 w-4 text-muted-foreground" />{s.email || facility.email}</span>
                  )}
                </div>
              </section>
            );
          case "location":
            return (
              <section key={block.id} aria-labelledby={`w-${block.id}`} className="space-y-3">
                <h2 id={`w-${block.id}`} className="text-lg font-semibold">{s.title || "Find us"}</h2>
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4" />
                  {s.address || [facility.addressLine, facility.city, facility.state].filter(Boolean).join(", ")}
                </p>
                {s.mapUrl && (
                  <a href={s.mapUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline">
                    Open in maps
                  </a>
                )}
              </section>
            );
          case "appointment-booking":
            return (
              <section key={block.id} aria-labelledby={`w-${block.id}`} className="rounded-2xl border border-border bg-card p-6 text-center">
                <h2 id={`w-${block.id}`} className="text-lg font-semibold">{s.title || "Book an appointment"}</h2>
                {s.body && <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{s.body}</p>}
                <Link
                  href={`/${directory}/${slug}#services`}
                  className="pill-btn pill-btn-primary mt-4 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
                >
                  <CalendarCheck aria-hidden="true" className="h-4 w-4" />
                  {s.buttonLabel || "Request a booking"}
                </Link>
              </section>
            );
          case "cta":
            return (
              <section key={block.id} aria-labelledby={`w-${block.id}`} className="rounded-2xl bg-foreground p-6 text-background md:p-8">
                <h2 id={`w-${block.id}`} className="text-xl font-bold">{s.heading || "Book your visit today"}</h2>
                {s.body && <p className="mt-2 max-w-xl text-sm opacity-80">{s.body}</p>}
                <Link
                  href={s.buttonHref || `/${directory}/${slug}#services`}
                  className="pill-btn mt-4 inline-flex items-center gap-2 bg-background px-5 py-2.5 text-sm font-semibold text-foreground"
                >
                  {s.buttonLabel || "Contact us"} <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </section>
            );
          case "gallery":
            return (
              <section key={block.id} aria-labelledby={`w-${block.id}`} className="space-y-3">
                <h2 id={`w-${block.id}`} className="text-lg font-semibold">{s.title || "Gallery"}</h2>
                <p className="text-sm text-muted-foreground">Photos of our facility coming soon.</p>
              </section>
            );
          case "faq": {
            const items = (block.settings as { items?: { question: string; answer: string }[] }).items ?? [];
            if (items.length === 0) return null;
            return (
              <section key={block.id} aria-labelledby={`w-${block.id}`} className="space-y-3">
                <h2 id={`w-${block.id}`} className="text-lg font-semibold">{s.title || "Frequently asked questions"}</h2>
                <div className="space-y-2">
                  {items.map((f, i) => (
                    <Card key={i} className="beeline-card">
                      <CardContent className="space-y-1 p-4">
                        <p className="text-sm font-medium">{f.question}</p>
                        <p className="text-sm text-muted-foreground">{f.answer}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            );
          }
          default:
            return null;
        }
      })}
      <p className="text-xs text-muted-foreground">
        <Badge variant="outline" className="mr-2 rounded-lg text-[10px]">Custom website</Badge>
        Sections on this page are managed by the facility.
      </p>
    </div>
  );
}
