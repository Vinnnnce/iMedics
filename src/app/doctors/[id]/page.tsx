import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingPanel } from "@/components/shared/booking-panel";
import { LikeButton, ReviewForm } from "@/components/shared/doctor-feedback";
import { requirePageRole } from "@/lib/guards";
import { getDoctorProfileView } from "@/lib/data/doctors";
import { clinicToday } from "@/lib/clinic-time";
import { formatDate, initials } from "@/lib/format";
import { z } from "zod";

export default async function DoctorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("PATIENT", "ADMIN");
  const parsed = z.string().uuid().safeParse((await params).id);
  if (!parsed.success) notFound();

  const view = await getDoctorProfileView(parsed.data, user);
  if (!view) notFound();
  const { doctor, reviews, viewer } = view;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <Card className="beeline-card">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-foreground/10 text-xl font-bold">{initials(doctor.name)}</div>
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">{doctor.name}</h1>
              {doctor.specialty && <Badge variant="secondary" className="rounded-lg">{doctor.specialty}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{[doctor.affiliation, doctor.location].filter(Boolean).join(" — ")}</p>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4" /> {doctor.ratingCount > 0 ? `${doctor.ratingAvg.toFixed(1)} (${doctor.ratingCount} reviews)` : "No reviews yet"}
              </span>
              {doctor.yearsOfExperience != null && <span className="text-muted-foreground">{doctor.yearsOfExperience} years of experience</span>}
              {doctor.consultationFee && <span className="text-muted-foreground">{doctor.currency} {doctor.consultationFee} per consultation</span>}
            </div>
            {user.role === "PATIENT" && <LikeButton doctorId={doctor.id} initialLiked={viewer.liked} initialCount={doctor.likeCount} />}
          </div>
        </CardContent>
      </Card>

      {(doctor.biography || doctor.education || doctor.languages.length > 0 || doctor.areasOfExpertise.length > 0) && (
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="text-lg">About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {doctor.biography && <p>{doctor.biography}</p>}
            {doctor.education && <p className="text-muted-foreground">Education: {doctor.education}</p>}
            {doctor.languages.length > 0 && <p className="text-muted-foreground">Languages: {doctor.languages.join(", ")}</p>}
            {doctor.areasOfExpertise.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {doctor.areasOfExpertise.map((a) => (
                  <Badge key={a} variant="outline" className="rounded-lg">{a}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {user.role === "PATIENT" && doctor.acceptingPatients && <BookingPanel doctorId={doctor.id} today={clinicToday()} />}
      {user.role === "PATIENT" && viewer.canReview && <ReviewForm doctorId={doctor.id} />}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Reviews</h2>
        {reviews.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet.</p>}
        {reviews.map((r) => (
          <Card key={r.id} className="beeline-card">
            <CardContent className="space-y-1 p-4 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium">{r.author}</p>
                <span className="flex items-center gap-1 text-xs">
                  <Star className="h-3 w-3 fill-current" /> {r.rating}/5
                </span>
              </div>
              {r.comment && <p className="text-muted-foreground">{r.comment}</p>}
              <p className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
