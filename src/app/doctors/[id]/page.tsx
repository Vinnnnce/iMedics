import { notFound } from "next/navigation";
import { BadgeCheck, ExternalLink, GraduationCap, Star } from "lucide-react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BookingPanel } from "@/components/shared/booking-panel";
import { LikeButton, ReviewForm } from "@/components/shared/doctor-feedback";
import { DownloadCvButton, NextAvailable, PortfolioSection, ReviewsSection, ShareProfileButton } from "@/components/shared/doctor-profile-extras";
import { requirePageRole } from "@/lib/guards";
import { getDoctorProfileView } from "@/lib/data/doctors";
import { clinicToday } from "@/lib/clinic-time";
import { formatDate, initials } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { SERVICE_KIND_LABELS, type ServiceKind } from "@/lib/doctor-profile";

const MODE_LABELS: Record<string, string> = { VIDEO: "Video", CHAT: "Chat", IN_PERSON: "In person" };
const VERIFICATION_LABELS: Record<string, string> = { VERIFIED: "Verified", PENDING: "Verification pending", REJECTED: "Rejected" };

function ChipRow({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <Badge key={value} variant="outline" className="rounded-lg">{value}</Badge>
        ))}
      </div>
    </div>
  );
}

export default async function DoctorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("PATIENT", "ADMIN");
  const parsed = z.string().uuid().safeParse((await params).id);
  if (!parsed.success) notFound();

  const view = await getDoctorProfileView(parsed.data, user);
  if (!view) notFound();
  const { doctor, reviews, viewer, services, portfolio, nextAvailableAt, reviewCategories } = view;

  const startingFee = services.length > 0 ? services.reduce((min, s) => (s.price < min ? s.price : min), services[0].price) : doctor.consultationFee;
  const linkedinVisible = doctor.linkedinPublic && doctor.linkedinUrl;
  const licenseExpired = doctor.licenseExpiry ? doctor.licenseExpiry.getTime() < new Date().getTime() : false;

  const faqs: { question: string; answer: string }[] = [
    {
      question: "How do I book a consultation?",
      answer: "Pick a service (when the doctor publishes a catalogue), choose a free slot from their published weekly availability, and pay to hold the slot. The price you see at checkout is the price you pay.",
    },
    {
      question: "What is the difference between a new and a follow-up consultation?",
      answer: "A follow-up rate can apply when you previously completed a standard consultation with the same doctor within their follow-up window. The exact rate is shown before you pay.",
    },
    {
      question: "Can I upload my previous results?",
      answer: "Yes. You can upload documents and images to your record and share them with the doctor before or during the consultation.",
    },
    {
      question: "How long is a consultation?",
      answer: "Each service lists its duration. For standard bookings, the length is the doctor's published slot length, shown when you choose a time.",
    },
    {
      question: "Can I get a prescription?",
      answer: "Prescriptions are issued after a consultation when the doctor judges one is clinically appropriate.",
    },
    {
      question: "What if I need to cancel?",
      answer: "Upcoming appointments can be cancelled from your dashboard. Refunds follow the platform's payment policy; paid consultations are refunded by the platform's payment team.",
    },
    {
      question: "Is my information confidential?",
      answer: "Only the doctor you book with can see your consultation. Reviews never show your clinical details, and doctors are asked not to include patient information in public replies.",
    },
    {
      question: "Can this doctor refer me to someone else?",
      answer: "Doctors can admit you to their care and coordinate with other doctors on the platform where a referral is appropriate.",
    },
    {
      question: "What languages does the doctor speak?",
      answer: doctor.languages.length > 0 ? `This doctor speaks ${doctor.languages.join(", ")}.` : "The doctor's languages are listed on their profile once provided.",
    },
    {
      question: "How do I join a video consultation?",
      answer: "At the appointment time, open the consultation from your dashboard: video visits open the doctor's consultation room, chat visits open a secure message thread.",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      {/* Overview */}
      <Card className="beeline-card">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
          {doctor.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={doctor.avatarUrl} alt={doctor.name} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-foreground/10 text-xl font-bold">{initials(doctor.name)}</div>
          )}
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">{doctor.name}</h1>
              {doctor.verificationStatus === "VERIFIED" && (
                <Badge className="rounded-lg"><BadgeCheck className="mr-1 h-3 w-3" /> Verified doctor</Badge>
              )}
              {doctor.specialty && <Badge variant="secondary" className="rounded-lg">{doctor.specialty}</Badge>}
              {doctor.subSpecialty && <Badge variant="outline" className="rounded-lg">{doctor.subSpecialty}</Badge>}
            </div>
            {doctor.professionalTitle && <p className="text-sm font-medium">{doctor.professionalTitle}</p>}
            {doctor.qualifications && <p className="text-sm text-muted-foreground">{doctor.qualifications}</p>}
            <p className="text-sm text-muted-foreground">{[doctor.affiliation, doctor.location].filter(Boolean).join(" — ")}</p>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4" /> {doctor.ratingCount > 0 ? `${doctor.ratingAvg.toFixed(1)} (${doctor.ratingCount} reviews)` : "No reviews yet"}
              </span>
              {doctor.yearsOfExperience != null && <span className="text-muted-foreground">{doctor.yearsOfExperience} years of experience</span>}
              {doctor.languages.length > 0 && <span className="text-muted-foreground">Speaks {doctor.languages.join(", ")}</span>}
            </div>
            {doctor.consultationModes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {doctor.consultationModes.map((mode) => (
                  <Badge key={mode} variant="outline" className="rounded-lg">{MODE_LABELS[mode] ?? mode}</Badge>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground">
                {startingFee === null
                  ? "Fee not published yet"
                  : `${startingFee > 0 ? formatMoney(startingFee, doctor.currency) : "Free"} per consultation`}
              </span>
            </div>
            <NextAvailable iso={nextAvailableAt} timezoneLabel="clinic time" />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {user.role === "PATIENT" && <LikeButton doctorId={doctor.id} initialLiked={viewer.liked} initialCount={doctor.likeCount} />}
              <ShareProfileButton />
              {doctor.cvFileId && <DownloadCvButton doctorId={doctor.id} />}
              {linkedinVisible && (
                <a
                  href={doctor.linkedinUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-accent"
                >
                  <ExternalLink className="mr-1 h-4 w-4" /> LinkedIn
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      {(doctor.biography || doctor.patientCarePhilosophy || doctor.consultationApproach || doctor.whenToBookGuidance || doctor.conditionsTreated.length > 0 || doctor.proceduresPerformed.length > 0 || doctor.clinicalInterests.length > 0 || doctor.education || doctor.languages.length > 0) && (
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="text-lg">About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {doctor.biography && (
              <Collapsible>
                <p>
                  {doctor.biography.slice(0, 400)}
                  {doctor.biography.length > 400 && <span className="text-muted-foreground">… </span>}
                </p>
                {doctor.biography.length > 400 && (
                  <>
                    <CollapsibleContent>
                      <p className="pt-1">{doctor.biography.slice(400)}</p>
                    </CollapsibleContent>
                    <CollapsibleTrigger className="text-sm underline underline-offset-2">
                      Read more
                    </CollapsibleTrigger>
                  </>
                )}
              </Collapsible>
            )}
            {doctor.patientCarePhilosophy && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Patient-care philosophy</p>
                <p className="text-muted-foreground">{doctor.patientCarePhilosophy}</p>
              </div>
            )}
            {doctor.consultationApproach && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Consultation approach</p>
                <p className="text-muted-foreground">{doctor.consultationApproach}</p>
              </div>
            )}
            {doctor.whenToBookGuidance && (
              <div className="rounded-lg border border-input p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">When to book this doctor</p>
                <p className="text-muted-foreground">{doctor.whenToBookGuidance}</p>
              </div>
            )}
            <ChipRow label="Conditions treated" values={doctor.conditionsTreated} />
            <ChipRow label="Procedures performed" values={doctor.proceduresPerformed} />
            <ChipRow label="Clinical interests" values={doctor.clinicalInterests} />
            <ChipRow label="Languages" values={doctor.languages} />
            {doctor.education && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Education</p>
                <p className="text-muted-foreground">{doctor.education}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Credentials and verification */}
      {(doctor.licensingAuthority || doctor.professionalMemberships.length > 0 || doctor.awards.length > 0 || doctor.hospitalAffiliations.length > 0 || doctor.identityVerification || doctor.licenseVerification || doctor.qualificationVerification) && (
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5" /> Credentials and verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {doctor.licensingAuthority && (
              <p className="text-muted-foreground">
                Licensed by {doctor.licensingAuthority}
                {doctor.licenseExpiry && (
                  <>
                    {" "}· Licence {licenseExpired ? "expired" : "valid"} until {formatDate(doctor.licenseExpiry)}
                  </>
                )}
              </p>
            )}
            {(doctor.identityVerification || doctor.licenseVerification || doctor.qualificationVerification) && (
              <div className="grid gap-2 sm:grid-cols-3">
                {([["Identity", doctor.identityVerification], ["Licence", doctor.licenseVerification], ["Qualifications", doctor.qualificationVerification]] as const).map(([label, status]) =>
                  status ? (
                    <div key={label} className="rounded-lg border border-input p-2">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <Badge variant={status === "VERIFIED" ? "default" : "outline"} className="mt-1 rounded-lg">
                        {VERIFICATION_LABELS[status] ?? status}
                      </Badge>
                    </div>
                  ) : null,
                )}
              </div>
            )}
            <ChipRow label="Professional memberships" values={doctor.professionalMemberships} />
            <ChipRow label="Hospital affiliations" values={doctor.hospitalAffiliations} />
            <ChipRow label="Awards and recognition" values={doctor.awards} />
          </CardContent>
        </Card>
      )}

      {/* Services and pricing */}
      {services.length > 0 && (
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="text-lg">Services and pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {services.map((service) => (
              <div key={service.id} className="rounded-lg border border-input p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{service.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {SERVICE_KIND_LABELS[service.kind as ServiceKind] ?? service.kind} · {service.durationMinutes} min
                      {service.modes.length > 0 && ` · ${service.modes.map((m) => MODE_LABELS[m] ?? m).join(", ")}`}
                    </p>
                  </div>
                  <p className="font-medium">
                    {service.price > 0 ? formatMoney(service.price, service.currency) : "Free"}
                    {service.followUpPrice !== null && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {service.followUpPrice > 0 ? formatMoney(service.followUpPrice, service.currency) : "Free"} follow-up
                        {service.followUpWindowDays ? ` (within ${service.followUpWindowDays} days)` : ""}
                      </span>
                    )}
                  </p>
                </div>
                {service.description && <p className="mt-1 text-muted-foreground">{service.description}</p>}
                {service.icd10Codes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {service.icd10Codes.map((code) => (
                      <Badge key={code} variant="outline" className="rounded-lg text-xs">{code}</Badge>
                    ))}
                  </div>
                )}
                {service.cancellationTerms && <p className="mt-1 text-xs text-muted-foreground">Cancellation: {service.cancellationTerms}</p>}
                {service.refundTerms && <p className="mt-1 text-xs text-muted-foreground">Refunds: {service.refundTerms}</p>}
                {service.includes.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Includes: {service.includes.join(", ")}</p>}
                {service.addOns.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Add-ons: {service.addOns.join(", ")}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {user.role === "PATIENT" && doctor.acceptingPatients && <BookingPanel doctorId={doctor.id} today={clinicToday()} services={services} />}
      {user.role === "PATIENT" && viewer.canReview && <ReviewForm doctorId={doctor.id} />}

      {portfolio.length > 0 && <PortfolioSection items={portfolio} />}

      <ReviewsSection
        reviews={reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt.toISOString(),
          author: r.author,
          doctorResponse: r.doctorResponse,
          doctorRespondedAt: r.doctorRespondedAt ? r.doctorRespondedAt.toISOString() : null,
        }))}
        categories={reviewCategories as Record<string, { avg: number; count: number } | null>}
      />

      {/* FAQ */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Frequently asked questions</h2>
        {faqs.map((faq) => (
          <Collapsible key={faq.question}>
            <div className="rounded-lg border border-input px-4 py-3">
              <CollapsibleTrigger className="text-left text-sm font-medium">{faq.question}</CollapsibleTrigger>
              <CollapsibleContent>
                <p className="pt-2 text-sm text-muted-foreground">{faq.answer}</p>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </section>
    </div>
  );
}
