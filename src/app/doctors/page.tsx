import { formatMoney } from "@/lib/money";
import Link from "next/link";
import { Heart, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageRole } from "@/lib/guards";
import { DOCTOR_SORTS, listDoctors, listDoctorSpecialties, type DoctorSort } from "@/lib/data/doctors";
import { initials } from "@/lib/format";

const PAGE_SIZE = 20;

type Params = { q?: string; specialty?: string; rating?: string; fee?: string; sort?: string; page?: string };

/** The directory URL for a set of filters (empty values are dropped). */
function directoryHref(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && !(key === "page" && value === 1)) query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `/doctors?${text}` : "/doctors";
}

const SELECT_CLASS = "h-10 rounded-lg border border-input bg-background px-3 text-sm";

export default async function DoctorsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requirePageRole("PATIENT", "DOCTOR", "LAB_SCIENTIST", "ADMIN");
  const raw = await searchParams;
  const q = raw.q?.trim().slice(0, 100) || undefined;
  const specialty = raw.specialty?.trim().slice(0, 100) || undefined;
  const minRating = [1, 2, 3, 4].includes(Number(raw.rating)) ? Number(raw.rating) : undefined;
  const maxFee = raw.fee !== undefined && raw.fee !== "" && Number.isFinite(Number(raw.fee)) && Number(raw.fee) >= 0 ? Number(raw.fee) : undefined;
  const sort = (DOCTOR_SORTS as readonly string[]).includes(raw.sort ?? "") ? (raw.sort as DoctorSort) : "rating";
  const page = Math.max(1, Math.min(500, Number.parseInt(raw.page ?? "1", 10) || 1));

  const [{ doctors, total }, specialties] = await Promise.all([
    listDoctors({ search: q, specialty, minRating, maxFee, sort, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    listDoctorSpecialties(),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = { q, specialty, rating: minRating, fee: maxFee, sort: sort === "rating" ? undefined : sort };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Find Doctors</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verified doctors accepting new patients
        </p>
      </div>

      <form className="space-y-2" action="/doctors" aria-label="Search and filter doctors">
        <div className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name, specialty or location"
            aria-label="Search doctors"
            className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
          />
          <button className="h-10 rounded-lg bg-foreground px-4 text-sm text-background">
            Search
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <select name="specialty" defaultValue={specialty ?? ""} aria-label="Specialty" className={SELECT_CLASS}>
            <option value="">All specialties</option>
            {specialties.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <select name="rating" defaultValue={minRating ? String(minRating) : ""} aria-label="Minimum rating" className={SELECT_CLASS}>
            <option value="">Any rating</option>
            {[4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}+ stars</option>)}
          </select>
          <input
            name="fee"
            type="number"
            min={0}
            defaultValue={maxFee}
            placeholder="Max fee"
            aria-label="Maximum consultation fee"
            className={`${SELECT_CLASS} w-28`}
          />
          <select name="sort" defaultValue={sort} aria-label="Sort by" className={SELECT_CLASS}>
            <option value="rating">Top rated</option>
            <option value="fee_asc">Lowest fee</option>
            <option value="likes">Most liked</option>
            <option value="name">Name (A–Z)</option>
          </select>
          {(q || specialty || minRating || maxFee !== undefined || sort !== "rating") && (
            <Link href="/doctors" className="inline-flex h-10 items-center px-2 text-sm text-muted-foreground underline underline-offset-4">
              Clear filters
            </Link>
          )}
        </div>
      </form>

      <p className="text-xs text-muted-foreground" role="status">
        {total} doctor{total === 1 ? "" : "s"} found
      </p>

      <div className="space-y-3">
        {doctors.map((d) => (
          <Link key={d.id} href={`/doctors/${d.id}`}>
            <Card className="beeline-card transition-colors hover:bg-muted/50">
              <CardContent className="flex items-start gap-3 p-4">
                {d.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.avatarUrl}
                    alt={d.name}
                    className="flex h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-foreground/10 font-bold">
                    {initials(d.name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[d.specialty, d.affiliation].filter(Boolean).join(" — ") ||
                      "Doctor"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {d.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {d.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3" />{" "}
                      {d.ratingCount > 0
                        ? `${d.ratingAvg.toFixed(1)} (${d.ratingCount})`
                        : "No reviews yet"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" /> {d.likeCount}
                    </span>
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-lg">
                  {d.consultationFee === null
                    ? "Fee not set"
                    : d.consultationFee > 0
                      ? formatMoney(d.consultationFee, d.currency)
                      : "Free"}
                </Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
        {doctors.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No doctors match your search. Try removing a filter.
          </p>
        )}
      </div>

      {pageCount > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={directoryHref({ ...current, page: page - 1 })} className="underline underline-offset-4">← Previous</Link>
          ) : <span />}
          <span className="text-xs text-muted-foreground">Page {page} of {pageCount}</span>
          {page < pageCount ? (
            <Link href={directoryHref({ ...current, page: page + 1 })} className="underline underline-offset-4">Next →</Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
