import { notFound } from "next/navigation";
import { Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FacilityBookForm } from "@/components/shared/facility-book-form";
import { CATEGORY_LABEL } from "@/lib/facility-services";
import { requirePageRole } from "@/lib/guards";
import { getFacility } from "@/lib/facilities";
import { formatMoney } from "@/lib/money";
import { z } from "zod";

export default async function FacilityPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("PATIENT", "ADMIN");
  const parsed = z.string().uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const facility = await getFacility(parsed.data);
  if (!facility) notFound();
  const address = [facility.addressLine, facility.city, facility.state].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 md:px-0">
      <Card className="beeline-card">
        <CardContent className="space-y-2 p-5">
          <h1 className="text-xl font-bold">{facility.name}</h1>
          {facility.about && <p className="text-sm text-muted-foreground">{facility.about}</p>}
          {address && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> {address}
            </p>
          )}
          {facility.operatingHours && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" /> {facility.operatingHours}
            </p>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Services and prices</h2>
        {facility.services.map((s) => (
          <Card key={s.id} className="beeline-card">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{s.name}</p>
                  <Badge variant="outline" className="rounded-lg text-xs">
                    {CATEGORY_LABEL[s.category]}
                  </Badge>
                </div>
                <p className="text-sm font-medium">{s.price > 0 ? formatMoney(s.price, s.currency) : "Free"}</p>
                {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                {s.availability && <p className="text-xs text-muted-foreground">{s.availability}</p>}
              </div>
              {user.role === "PATIENT" && <FacilityBookForm service={s} facility={facility} />}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
