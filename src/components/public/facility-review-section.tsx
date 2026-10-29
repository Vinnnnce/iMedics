"use client";

import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface PublicFacilityReview {
  id: string;
  rating: number;
  comment: string | null;
  facilityResponse: string | null;
  createdAt: string;
  author: string;
}

/**
 * Patient reviews on a public facility profile: the aggregate rating, the
 * approved review list, and — for signed-in patients — a compact submit form
 * (one review per patient per facility, upsert server-side).
 */
export function FacilityReviewSection({
  facilityId,
  canReview,
  initialReviews,
  initialAverage,
  initialCount,
}: {
  facilityId: string;
  canReview: boolean;
  initialReviews: PublicFacilityReview[];
  initialAverage: number | null;
  initialCount: number;
}) {
  const [reviews, setReviews] = useState(initialReviews);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (rating < 1) {
      setError("Choose a star rating first");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/facility-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId, rating, comment: comment.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
      setRating(0);
      setComment("");
      // Refresh the public list so the new review appears once approved.
      const list = await fetch(`/api/facility-reviews?facilityId=${facilityId}`);
      if (list.ok) {
        const data = await list.json();
        setReviews(data.reviews ?? []);
      }
    } catch {
      setError("Could not submit your review. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="reviews-heading" className="space-y-3">
      <h2 id="reviews-heading" className="text-lg font-semibold">Patient reviews</h2>

      {initialAverage !== null && (
        <p className="flex items-center gap-2 text-sm" data-testid="facility-rating-summary">
          <span className="flex items-center gap-0.5" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} className={`h-4 w-4 ${i < Math.round(initialAverage) ? "fill-foreground text-foreground" : "text-muted-foreground/40"}`} />
            ))}
          </span>
          <span className="font-semibold">{initialAverage.toFixed(1)}</span>
          <span className="text-muted-foreground">
            from {initialCount} patient {initialCount === 1 ? "review" : "reviews"}
          </span>
        </p>
      )}

      {reviews.length === 0 && initialAverage === null && (
        <p className="text-sm text-muted-foreground" data-testid="text-no-reviews">
          No patient reviews yet.
        </p>
      )}

      {reviews.length > 0 && (
        <ul className="space-y-2" data-testid="list-facility-reviews">
          {reviews.map(review => (
            <li key={review.id} className="rounded-xl border border-border bg-card p-4 text-sm">
              <p className="flex items-center gap-2">
                <span className="flex items-center gap-0.5" aria-label={`${review.rating} out of 5`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} aria-hidden="true" className={`h-3.5 w-3.5 ${i < review.rating ? "fill-foreground text-foreground" : "text-muted-foreground/40"}`} />
                  ))}
                </span>
                <span className="text-xs text-muted-foreground">{review.author}</span>
              </p>
              {review.comment && <p className="mt-2">{review.comment}</p>}
              {review.facilityResponse && (
                <p className="mt-2 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                  Facility replied: {review.facilityResponse}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {canReview && (
        <div className="rounded-xl border border-border bg-card p-4" data-testid="facility-review-form">
          {submitted ? (
            <p className="text-sm text-muted-foreground" data-testid="text-review-submitted">
              Thank you — your rating has been recorded.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium">Rate this facility</p>
              <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Your rating">
                {Array.from({ length: 5 }, (_, i) => {
                  const value = i + 1;
                  const filled = value <= (hovered || rating);
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={rating === value}
                      aria-label={`${value} star${value > 1 ? "s" : ""}`}
                      onMouseEnter={() => setHovered(value)}
                      onMouseLeave={() => setHovered(0)}
                      onClick={() => setRating(value)}
                      className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      data-testid={`button-star-${value}`}
                    >
                      <Star className={`h-5 w-5 ${filled ? "fill-foreground text-foreground" : "text-muted-foreground/40"}`} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
              <Textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Share your experience (optional)"
                rows={2}
                maxLength={2000}
                className="mt-3"
                aria-label="Review comment"
                data-testid="input-review-comment"
              />
              {error && <p className="mt-2 text-sm text-destructive" role="alert" data-testid="text-review-error">{error}</p>}
              <div className="mt-3 flex justify-end">
                <Button type="button" onClick={() => void submit()} disabled={busy} data-testid="button-submit-review">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Submit review
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
