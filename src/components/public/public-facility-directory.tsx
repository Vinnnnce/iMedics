import Link from "next/link";
import { BadgeCheck, MapPin, FlaskConical, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listPublicFacilities } from "@/lib/public-facilities";
import { initials } from "@/lib/format";
import { PublicFooter } from "@/components/home/public-footer";

interface DirectoryPageProps {
  directory: "hospitals" | "laboratories" | "diagnostic-centres";
  typeLabel: string;
  pluralLabel: string;
  searchPlaceholder: string;
  q?: string;
}

/** Public, sign-in-free directory of verified facilities with published portfolios. */
export async function PublicFacilityDirectory({ directory, typeLabel, pluralLabel, searchPlaceholder, q }: DirectoryPageProps) {
  const facilities = await listPublicFacilities({ directory, q });

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 pb-12 md:px-0">
      <header className="space-y-3 pt-8">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Medic1905
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Find a {typeLabel.toLowerCase()}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verified {pluralLabel.toLowerCase()} on Medic1905 — services, transparent prices and online booking.
          </p>
        </div>
      </header>

      <form action={`/${directory}`} className="flex gap-2" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder={searchPlaceholder}
          aria-label={`Search ${pluralLabel.toLowerCase()}`}
          className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
        />
        <button type="submit" className="h-10 rounded-lg bg-foreground px-4 text-sm text-background">
          Search
        </button>
      </form>

      {facilities.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No {pluralLabel.toLowerCase()} match your search yet. New facilities publish their pages regularly.
        </p>
      )}

      <div className="grid gap-3">
        {facilities.map((f) => (
          <Link key={f.id} href={`/${directory}/${f.slug}`} className="block">
            <Card className="beeline-card h-full transition-colors hover:bg-muted/50">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-foreground/10 text-sm font-bold">
                  {initials(f.laboratoryName ?? "F")}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{f.laboratoryName}</p>
                    <Badge variant="secondary" className="rounded-lg text-xs">
                      <BadgeCheck aria-hidden="true" className="mr-1 h-3 w-3 text-emerald-600" />
                      Medic1905 Verified
                    </Badge>
                  </div>
                  {f.tagline && <p className="text-xs text-muted-foreground">{f.tagline}</p>}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {f.ratingCount != null && f.ratingCount > 0 && f.ratingAvg != null ? (
                      <>
                        <span className="flex items-center gap-0.5" aria-label={`Rated ${f.ratingAvg.toFixed(1)} of 5 from ${f.ratingCount} reviews`}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              aria-hidden="true"
                              className={`h-3.5 w-3.5 ${i < Math.round(f.ratingAvg) ? "fill-foreground text-foreground" : "text-muted-foreground/40"}`}
                            />
                          ))}
                        </span>
                        <span>
                          {f.ratingAvg.toFixed(1)} · {f.ratingCount} review{f.ratingCount === 1 ? "" : "s"}
                        </span>
                      </>
                    ) : (
                      <span>No patient reviews yet</span>
                    )}
                  </div>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin aria-hidden="true" className="h-3 w-3" />
                    {[f.city, f.state].filter(Boolean).join(", ") || "Location on request"}
                  </p>
                </div>
                <FlaskConical aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <PublicFooter />
    </div>
  );
}
