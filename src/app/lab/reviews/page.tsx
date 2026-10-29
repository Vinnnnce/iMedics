import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReviewResponseForm } from "@/components/lab/review-response";
import { requireFacilityPortalPage } from "@/lib/guards";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { prisma } from "@/lib/prisma";
import { formatClinicDateTime } from "@/lib/format";

// Facility staff review management (all facility kinds): read patient reviews
// of your facility and publish or edit your official response. The response
// appears publicly on the facility portfolio next to the review.
export default async function FacilityReviewsPage() {
  const user = await requireFacilityPortalPage();
  const facility = await resolveFacilityForPortalUser(user);
  if (!facility) return null;

  const reviews = await prisma.facilityReview.findMany({
    where: { facilityId: facility.id, moderationStatus: "APPROVED" },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      rating: true,
      comment: true,
      facilityResponse: true,
      respondedAt: true,
      createdAt: true,
      patient: { select: { firstName: true, lastName: true } },
    },
  });

  const average =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Reviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Patient reviews of your facility{average ? ` · average ${average} of 5 across ${reviews.length} review${reviews.length === 1 ? "" : "s"}` : ""}.
        </p>
      </div>

      {reviews.length === 0 && (
        <Card className="beeline-card">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No approved patient reviews yet. Reviews appear here once patients leave them.
          </CardContent>
        </Card>
      )}

      {reviews.map((review) => (
        <Card key={review.id} className="beeline-card">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">
                {review.patient.firstName} {review.patient.lastName}
              </CardTitle>
              <Badge variant="outline" className="rounded-lg text-xs">
                {formatClinicDateTime(review.createdAt)}
              </Badge>
              <span className="flex items-center gap-0.5" aria-label={`${review.rating} of 5 stars`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < review.rating ? "fill-foreground text-foreground" : "text-muted-foreground/40"}`}
                  />
                ))}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {review.comment && <p className="whitespace-pre-wrap text-sm">{review.comment}</p>}
            {review.facilityResponse && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Your response{review.respondedAt ? ` · ${formatClinicDateTime(review.respondedAt)}` : ""}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{review.facilityResponse}</p>
              </div>
            )}
            <ReviewResponseForm
              reviewId={review.id}
              initialResponse={review.facilityResponse ?? ""}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
