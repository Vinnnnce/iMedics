import { formatMoney } from "@/lib/money";
import Link from "next/link";
import { Heart, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageRole } from "@/lib/guards";
import { listDoctors } from "@/lib/data/doctors";
import { initials } from "@/lib/format";

export default async function DoctorsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePageRole("PATIENT", "ADMIN");
  const q = (await searchParams).q?.trim().slice(0, 100) || undefined;
  const { doctors, total } = await listDoctors({ search: q, limit: 30 });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Find Doctors</h1>
        <p className="mt-1 text-sm text-muted-foreground">Verified doctors accepting new patients</p>
      </div>

      <form className="flex gap-2" action="/doctors">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name, specialty or location"
          className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
        />
        <button className="h-10 rounded-lg bg-foreground px-4 text-sm text-background">Search</button>
      </form>

      <p className="text-xs text-muted-foreground">
        {total} doctor{total === 1 ? "" : "s"} found
      </p>

      <div className="space-y-3">
        {doctors.map((d) => (
          <Link key={d.id} href={`/doctors/${d.id}`}>
            <Card className="beeline-card transition-colors hover:bg-muted/50">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-foreground/10 font-bold">{initials(d.name)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{[d.specialty, d.affiliation].filter(Boolean).join(" — ") || "Doctor"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {d.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {d.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3" /> {d.ratingCount > 0 ? `${d.ratingAvg.toFixed(1)} (${d.ratingCount})` : "No reviews yet"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" /> {d.likeCount}
                    </span>
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-lg">
                  {d.consultationFee === null ? "Fee not set" : d.consultationFee > 0 ? formatMoney(d.consultationFee, d.currency) : "Free"}
                </Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
        {doctors.length === 0 && <p className="text-sm text-muted-foreground">No doctors match your search.</p>}
      </div>
    </div>
  );
}
