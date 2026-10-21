import Link from "next/link";
import type { Metadata } from "next";
import { BadgeCheck, MapPin, Phone, Mail, Clock, Building2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PublicFooter } from "@/components/home/public-footer";
import {
  getPublicFacilityBySlug,
  listPublicFacilityStaff,
  listPublicFacilityServices,
  facilityJsonLd,
  publicStaffProfile,
  DIRECTORY_TYPE_LABEL,
} from "@/lib/public-facilities";
import { FacilityServiceCatalog } from "./facility-service-catalog";
import { getCurrentUser } from "@/lib/auth";
import { initials } from "@/lib/format";
import { FacilityWebsiteRenderer } from "./facility-website-renderer";
import { FacilityReviewSection } from "./facility-review-section";
import { prisma } from "@/lib/prisma";
import { parseWebsiteLayout } from "@/lib/website/blocks";

interface PortfolioPageInput {
  directory: "hospitals" | "laboratories" | "diagnostic-centres";
  slug: string;
}

/** Fetch everything the portfolio needs. 404s when the facility is not public. */
async function loadPortfolio(directory: string, slug: string) {
  const facility = await getPublicFacilityBySlug(directory, slug);
  const [staff, services] = await Promise.all([
    listPublicFacilityStaff(facility.id),
    listPublicFacilityServices(facility.id),
  ]);
  // Patient reviews are an enhancement: if the table is missing or the query
  // fails (e.g. the database migration has not been applied yet), the public
  // facility profile must still render. Failures are logged, not shown.
  let reviews: { rating: number; count: number; list: { id: string; rating: number; comment: string | null; facilityResponse: string | null; createdAt: Date; author: string }[] } | null = null;
  try {
    const [approved, aggregate] = await Promise.all([
      prisma.facilityReview.findMany({
        where: { facilityId: facility.id, moderationStatus: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true, rating: true, comment: true, facilityResponse: true, createdAt: true,
          patient: { select: { firstName: true } },
        },
      }),
      prisma.facilityReview.aggregate({
        where: { facilityId: facility.id, moderationStatus: "APPROVED" },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);
    reviews = {
      rating: aggregate._avg.rating ?? 0,
      count: aggregate._count.rating,
      list: approved.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        facilityResponse: review.facilityResponse,
        createdAt: review.createdAt,
        author: review.patient?.firstName ? `${review.patient.firstName}.` : "A patient",
      })),
    };
  } catch (error) {
    console.error(
      "[facility-portfolio] patient reviews unavailable — has `prisma migrate deploy` been run?",
      error instanceof Error ? error.message : error,
    );
  }
  // The mini-website section is an enhancement: if its table is missing or the
  // query fails (e.g. the database migration has not been applied yet), the
  // public facility profile must still render. Failures are logged, not shown
  // to visitors as a broken page.
  let website: { publishedLayout: unknown } | null = null;
  try {
    website = await prisma.facilityWebsite.findUnique({
      where: { facilityId: facility.id },
      select: { publishedLayout: true },
    });
  } catch (error) {
    console.error(
      "[facility-portfolio] mini-website unavailable — has `prisma migrate deploy` been run?",
      error instanceof Error ? error.message : error,
    );
  }
  return { facility, staff: staff.map(publicStaffProfile), services, website, reviews };
}

export async function generatePortfolioMetadata({ directory, slug }: PortfolioPageInput): Promise<Metadata> {
  try {
    const { facility } = await loadPortfolio(directory, slug);
    const name = facility.laboratoryName ?? "Facility";
    const type = DIRECTORY_TYPE_LABEL[directory] ?? "Facility";
    return {
      title: `${name} — ${type} on Medic1905`,
      description:
        facility.tagline ??
        `${name}: ${type.toLowerCase()} in ${[facility.city, facility.state].filter(Boolean).join(", ")}. View services, prices and book online.`,
      alternates: { canonical: `/${directory}/${slug}` },
      openGraph: {
        title: `${name} — ${type} on Medic1905`,
        description: facility.tagline ?? undefined,
        type: "profile",
      },
    };
  } catch {
    return { title: "Facility not found — Medic1905" };
  }
}

/** Public facility mini-portfolio: profile, services and prices, departments, team, accreditations. */
export async function FacilityPortfolio({ directory, slug }: PortfolioPageInput) {
  const { facility, staff, services, website, reviews } = await loadPortfolio(directory, slug);
  const publishedLayout = website?.publishedLayout ? parseWebsiteLayout(website.publishedLayout) : null;
  const user = await getCurrentUser();
  const canBook = user?.role === "PATIENT" && user.status === "ACTIVE";
  const type = DIRECTORY_TYPE_LABEL[directory] ?? "Facility";
  const name = facility.laboratoryName ?? "Facility";

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 pb-12 md:px-0">
      <script
        type="application/ld+json"
        // Structured data: only public, non-sensitive fields.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(facilityJsonLd(facility)) }}
      />

      {/* Header */}
      <header className="space-y-4 pt-8">
        <Link href={`/${directory}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← All {type.toLowerCase()}s
        </Link>
        <div className="flex flex-wrap items-start gap-4">
          {facility.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={facility.logoUrl} alt={`${name} logo`} className="h-16 w-16 rounded-xl object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-foreground/10 text-lg font-bold">
              {initials(name)}
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{name}</h1>
              <Badge variant="secondary" className="rounded-lg text-xs">
                <BadgeCheck aria-hidden="true" className="mr-1 h-3 w-3 text-emerald-600" />
                Medic1905 Verified Facility
              </Badge>
              <Badge variant="outline" className="rounded-lg text-xs">{type}</Badge>
            </div>
            {facility.tagline && <p className="text-sm text-muted-foreground">{facility.tagline}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {facility.addressLine && (
                <span className="flex items-center gap-1"><MapPin aria-hidden="true" className="h-3 w-3" />{[facility.addressLine, facility.city, facility.state].filter(Boolean).join(", ")}</span>
              )}
              {facility.phone && (
                <span className="flex items-center gap-1"><Phone aria-hidden="true" className="h-3 w-3" />{facility.phone}</span>
              )}
              {facility.email && (
                <span className="flex items-center gap-1"><Mail aria-hidden="true" className="h-3 w-3" />{facility.email}</span>
              )}
              {facility.operatingHours && (
                <span className="flex items-center gap-1"><Clock aria-hidden="true" className="h-3 w-3" />{facility.operatingHours}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="#services" className="pill-btn pill-btn-primary inline-flex items-center px-4 py-2 text-xs font-semibold">
                Book a test or appointment
              </Link>
              <Link href="#team" className="pill-btn pill-btn-outline inline-flex items-center px-4 py-2 text-xs font-semibold">
                Meet our team
              </Link>
              <Link href="#contact" className="pill-btn pill-btn-outline inline-flex items-center px-4 py-2 text-xs font-semibold">
                Contact facility
              </Link>
            </div>
          </div>
        </div>
        {facility.emergencyContact && (
          <Card className="beeline-card">
            <CardContent className="p-3 text-xs text-muted-foreground">
              Emergency contact: {facility.emergencyContact}
            </CardContent>
          </Card>
        )}
      </header>

      {/* Custom mini-website sections (published by the facility) */}
      {publishedLayout && (
        <FacilityWebsiteRenderer layout={publishedLayout} facility={facility} directory={directory} slug={slug} />
      )}

      {/* About */}
      {!publishedLayout && (facility.about || facility.mission || facility.vision) && (
        <section aria-labelledby="about-heading" className="space-y-3">
          <h2 id="about-heading" className="text-lg font-semibold">About the facility</h2>
          {facility.about && <p className="text-sm text-muted-foreground">{facility.about}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {facility.mission && (
              <Card className="beeline-card"><CardContent className="p-4 text-sm"><p className="font-medium">Mission</p><p className="text-muted-foreground">{facility.mission}</p></CardContent></Card>
            )}
            {facility.vision && (
              <Card className="beeline-card"><CardContent className="p-4 text-sm"><p className="font-medium">Vision</p><p className="text-muted-foreground">{facility.vision}</p></CardContent></Card>
            )}
          </div>
          <dl className="grid gap-x-6 gap-y-2 text-xs text-muted-foreground sm:grid-cols-2">
            {facility.ownershipType && <div className="flex gap-1"><dt>Ownership:</dt><dd className="text-foreground">{facility.ownershipType.replace("_", " ").toLowerCase()}</dd></div>}
            {facility.establishedYear && <div className="flex gap-1"><dt>Established:</dt><dd className="text-foreground">{facility.establishedYear}</dd></div>}
            {facility.bedCount != null && <div className="flex gap-1"><dt>Beds:</dt><dd className="text-foreground">{facility.bedCount}</dd></div>}
            {facility.theatreCount != null && <div className="flex gap-1"><dt>Theatres:</dt><dd className="text-foreground">{facility.theatreCount}</dd></div>}
            {facility.imagingRoomCount != null && <div className="flex gap-1"><dt>Imaging rooms:</dt><dd className="text-foreground">{facility.imagingRoomCount}</dd></div>}
            {facility.languagesSpoken.length > 0 && <div className="flex gap-1"><dt>Languages:</dt><dd className="text-foreground">{facility.languagesSpoken.join(", ")}</dd></div>}
            {facility.paymentMethods.length > 0 && <div className="flex gap-1"><dt>Payment methods:</dt><dd className="text-foreground">{facility.paymentMethods.join(", ")}</dd></div>}
          </dl>
        </section>
      )}

      {/* Branches */}
      {facility.branches.length > 0 && (
        <section aria-labelledby="branches-heading" className="space-y-3">
          <h2 id="branches-heading" className="text-lg font-semibold">Branches</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {facility.branches.map((b) => (
              <Card key={b.id} className="beeline-card">
                <CardContent className="space-y-1 p-4 text-sm">
                  <p className="font-medium">{b.name}{b.isPrimary ? " (main)" : ""}</p>
                  <p className="text-xs text-muted-foreground">{[b.addressLine, b.city, b.state].filter(Boolean).join(", ")}</p>
                  {b.phone && <p className="text-xs text-muted-foreground">{b.phone}</p>}
                  {b.openingHours && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock aria-hidden="true" className="h-3 w-3" />{b.openingHours}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Services and prices */}
      <section aria-labelledby="services-heading" id="services" className="space-y-3">
        <h2 id="services-heading" className="text-lg font-semibold">Services and prices</h2>
        <FacilityServiceCatalog
          services={services.map((s) => ({
            ...s,
            price: Number(s.price),
          }))}
          canBook={Boolean(canBook)}
          signInUrl={`/auth/login?redirect=${encodeURIComponent(`/${directory}/${slug}`)}`}
          facility={{
            name,
            addressLine: facility.addressLine,
            city: facility.city,
            state: facility.state,
            operatingHours: facility.operatingHours,
          }}
        />
      </section>

      {/* Departments */}
      {facility.facilityDepartments.length > 0 && (
        <section aria-labelledby="departments-heading" className="space-y-3">
          <h2 id="departments-heading" className="text-lg font-semibold">Departments and units</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {facility.facilityDepartments.map((d) => (
              <Card key={d.id} className="beeline-card">
                <CardContent className="space-y-1 p-4 text-sm">
                  <p className="font-medium">{d.name}</p>
                  {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                  {d.leadStaff && <p className="text-xs text-muted-foreground">Lead: {d.leadStaff.fullName}{d.leadStaff.professionalTitle ? `, ${d.leadStaff.professionalTitle}` : ""}</p>}
                  {d.openingHours && <p className="text-xs text-muted-foreground">{d.openingHours}</p>}
                  {d.equipment.length > 0 && (
                    <p className="text-xs text-muted-foreground">Equipment: {d.equipment.join(", ")}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Team */}
      <section aria-labelledby="team-heading" id="team" className="space-y-3">
        <h2 id="team-heading" className="text-lg font-semibold">Our team</h2>
        {staff.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Team profiles appear here when staff members consent to being listed publicly.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {staff.map((s) => (
            <Card key={s.id} className="beeline-card">
              <CardContent className="flex items-start gap-3 p-4">
                {s.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.photoUrl} alt={s.fullName} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground/10 text-sm font-bold">
                    {initials(s.fullName)}
                  </div>
                )}
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{s.fullName}</p>
                  {s.professionalTitle && <p className="text-xs text-muted-foreground">{s.professionalTitle}</p>}
                  {s.department && <p className="text-xs text-muted-foreground">{s.department.name}</p>}
                  {s.specialty && <p className="text-xs text-muted-foreground">{s.specialty}</p>}
                  {s.qualifications && <p className="text-xs text-muted-foreground">{s.qualifications}</p>}
                  {s.languages.length > 0 && <p className="text-xs text-muted-foreground">Speaks {s.languages.join(", ")}</p>}
                  {s.linkedinUrl && (
                    <a href={s.linkedinUrl} rel="noopener noreferrer" target="_blank" className="text-xs underline">
                      LinkedIn profile
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Staff choose what to publish. Private contact details are never shown.
        </p>
      </section>

      {/* Accreditations */}
      {facility.accreditations.length > 0 && (
        <section aria-labelledby="accreditation-heading" className="space-y-3">
          <h2 id="accreditation-heading" className="text-lg font-semibold">Accreditation and quality</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {facility.accreditations.map((a) => (
              <Card key={a.id} className="beeline-card">
                <CardContent className="space-y-1 p-4 text-sm">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{a.name}</p>
                    {a.verified && (
                      <Badge variant="secondary" className="rounded-lg text-xs">
                        <ShieldCheck aria-hidden="true" className="mr-1 h-3 w-3 text-emerald-600" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Issued by {a.issuer}</p>
                  {a.expiresAt && <p className="text-xs text-muted-foreground">Valid until {new Date(a.expiresAt).toLocaleDateString()}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            The verified badge appears only after Medic1905 checks the document with the issuing body.
          </p>
        </section>
      )}

      {/* Patient resources */}
      <section aria-labelledby="resources-heading" className="space-y-3">
        <h2 id="resources-heading" className="text-lg font-semibold">Patient information</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="beeline-card">
            <CardContent className="space-y-1 p-4 text-sm">
              <p className="font-medium">Before your visit</p>
              <p className="text-xs text-muted-foreground">
                Check each service&apos;s preparation instructions (for example fasting tests). Bring your ID and any
                referral a service requires.
              </p>
            </CardContent>
          </Card>
          <Card className="beeline-card">
            <CardContent className="space-y-1 p-4 text-sm">
              <p className="font-medium">Results and reports</p>
              <p className="text-xs text-muted-foreground">
                When your result is ready you receive a notification and can view it in your Medic1905 account.
              </p>
            </CardContent>
          </Card>
          <Card className="beeline-card">
            <CardContent className="space-y-1 p-4 text-sm">
              <p className="font-medium">Payments</p>
              <p className="text-xs text-muted-foreground">
                Prices are shown before you book. Pay securely online; refunds follow the facility&apos;s cancellation
                policy shown at checkout.
              </p>
            </CardContent>
          </Card>
          <Card className="beeline-card">
            <CardContent className="space-y-1 p-4 text-sm">
              <p className="font-medium">Your privacy</p>
              <p className="text-xs text-muted-foreground">
                Patient records are private. Facility staff access is limited to your care, role-based and fully
                audited.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Patient reviews */}
      {reviews && (
        <FacilityReviewSection
          facilityId={facility.id}
          canReview={user?.role === "PATIENT" && user.status === "ACTIVE"}
          initialReviews={reviews.list.map(review => ({
            ...review,
            createdAt: review.createdAt.toISOString(),
          }))}
          initialAverage={reviews.count > 0 ? reviews.rating : null}
          initialCount={reviews.count}
        />
      )}

      {/* Contact */}
      <section aria-labelledby="contact-heading" id="contact" className="space-y-3">
        <h2 id="contact-heading" className="text-lg font-semibold">Contact</h2>
        <Card className="beeline-card">
          <CardContent className="space-y-1 p-4 text-sm">
            <p className="flex items-center gap-2"><Building2 aria-hidden="true" className="h-4 w-4 text-muted-foreground" />{[facility.addressLine, facility.city, facility.state].filter(Boolean).join(", ")}</p>
            {facility.phone && <p className="flex items-center gap-2"><Phone aria-hidden="true" className="h-4 w-4 text-muted-foreground" />{facility.phone}</p>}
            {facility.email && <p className="flex items-center gap-2"><Mail aria-hidden="true" className="h-4 w-4 text-muted-foreground" />{facility.email}</p>}
            {facility.operatingHours && <p className="flex items-center gap-2"><Clock aria-hidden="true" className="h-4 w-4 text-muted-foreground" />{facility.operatingHours}</p>}
          </CardContent>
        </Card>
      </section>

      <PublicFooter />
    </div>
  );
}
