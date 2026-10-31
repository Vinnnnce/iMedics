import Link from "next/link";
import { Building2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageRole } from "@/lib/guards";
import { listFacilities } from "@/lib/facilities";
import { formatMoney } from "@/lib/money";
import { z } from "zod";

const TYPE_LABEL = { LABORATORY: "Laboratory", DIAGNOSTIC_CENTRE: "Diagnostic centre", HOSPITAL: "Hospital", PHARMACY: "Pharmacy" } as const;

export default async function FacilitiesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePageRole("PATIENT", "ADMIN");
  const { q } = await searchParams;
  const search = z.string().trim().max(100).optional().parse(q);
  const facilities = await listFacilities({ search });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold">Labs and diagnostic centres</h1>
          <p className="mt-1 text-sm text-muted-foreground">Compare services and prices, then book.</p>
        </div>
        <form className="flex gap-2">
          <input name="q" defaultValue={search} placeholder="Search a test or service" className="h-9 rounded-lg border border-input bg-background px-3 text-sm" />
        </form>
      </div>
      <Link href="/facilities/bookings" className="text-sm underline">
        My service bookings
      </Link>
      {facilities.length === 0 && <p className="text-sm text-muted-foreground">No facilities match your search.</p>}
      {facilities.map((f) => {
        const from = Math.min(...f.services.map((s) => s.price));
        const currency = f.services[0]?.currency ?? "NGN";
        return (
          <Link key={f.id} href={`/facilities/${f.id}`} className="block">
            <Card className="beeline-card transition-colors hover:bg-muted/40">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-foreground/10">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{f.name}</p>
                    {f.type && f.type in TYPE_LABEL && (
                      <Badge variant="outline" className="rounded-lg text-xs">
                        {TYPE_LABEL[f.type as keyof typeof TYPE_LABEL]}
                      </Badge>
                    )}
                  </div>
                  {(f.city || f.state) && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {[f.city, f.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {f.services.length} service{f.services.length === 1 ? "" : "s"}
                  <p className="text-sm font-semibold text-foreground">from {formatMoney(from, currency)}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
