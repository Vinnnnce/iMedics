"use client";

import { useEffect, useState } from "react";

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  moderationStatus: string;
  doctorName: string;
  doctorResponse: string | null;
  updatedAt: string;
}

const field = "bg-muted border border-border rounded px-2 py-1 text-xs text-foreground outline-none";

/** Admin-side review moderation: hiding a review also removes it from the doctor's averages. */
export function AdminReviewModeration() {
  const [reviews, setReviews] = useState<ReviewRow[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/reviews")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to load reviews");
        return res.json();
      })
      .then((data: { reviews: ReviewRow[] }) => {
        if (!cancelled) setReviews(data.reviews);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load reviews");
          setReviews([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const moderate = async (id: string, moderationStatus: string) => {
    setBusy(id);
    setError("");
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, moderationStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to moderate the review");
      setReviews((prev) => (prev ? prev.map((r) => (r.id === id ? { ...r, moderationStatus } : r)) : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to moderate the review");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="stat-card p-5 space-y-4">
      <div>
        <h3 className="font-semibold">Review moderation</h3>
        <p className="text-sm text-muted-foreground">
          Hidden reviews disappear from the doctor&rsquo;s profile and averages. Genuine negative reviews must
          follow the platform&rsquo;s moderation rules — a doctor cannot remove a review just because it is negative.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {reviews === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {reviews?.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet.</p>}
      {reviews?.map((review) => (
        <div key={review.id} className="rounded-lg border border-border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">
              {review.rating}/5 · {review.doctorName}
            </p>
            <select
              className={field}
              value={review.moderationStatus}
              disabled={busy === review.id}
              onChange={(e) => moderate(review.id, e.target.value)}
              data-testid={`select-moderation-${review.id}`}
            >
              <option value="APPROVED">Approved (visible)</option>
              <option value="PENDING">Pending (hidden)</option>
              <option value="REJECTED">Rejected (hidden)</option>
            </select>
          </div>
          {review.comment && <p className="mt-1 text-muted-foreground">{review.comment}</p>}
          {review.doctorResponse && <p className="mt-1 text-xs text-muted-foreground">Doctor replied: {review.doctorResponse}</p>}
        </div>
      ))}
    </div>
  );
}
