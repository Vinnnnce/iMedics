"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";

interface DoctorReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  author: string;
  doctorResponse: string | null;
}

/** The doctor's own reviews, with a public reply. Replies must not contain patient details. */
export function DoctorReviewsCard({ initial }: { initial: DoctorReviewRow[] }) {
  const [reviews] = useState(initial);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const respond = async (id: string) => {
    const response = drafts[id]?.trim();
    if (!response) return;
    setError("");
    try {
      await apiClient.post(`/doctor-reviews/${id}/respond`, { response });
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post your reply");
    }
  };

  return (
    <Card className="beeline-card">
      <CardHeader>
        <CardTitle className="text-lg">My reviews</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {reviews.length === 0 && <p className="text-muted-foreground">No reviews yet.</p>}
        {reviews.map((review) => (
          <div key={review.id} className="space-y-2 rounded-lg border border-input p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">{review.author}</p>
              <span className="flex items-center gap-1 text-xs">
                <Star className="h-3 w-3 fill-current" /> {review.rating}/5
              </span>
            </div>
            {review.comment && <p className="text-muted-foreground">{review.comment}</p>}
            {review.doctorResponse ? (
              <div className="rounded-lg bg-muted p-2 text-xs">
                <p className="font-medium">Your response</p>
                <p className="text-muted-foreground">{review.doctorResponse}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  className="min-h-16 w-full rounded-lg border border-input bg-background p-2 text-sm"
                  placeholder="Reply publicly (no patient details)"
                  maxLength={2000}
                  value={drafts[review.id] ?? ""}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [review.id]: e.target.value }))}
                />
                <Button size="sm" className="bg-foreground text-background rounded-lg" onClick={() => respond(review.id)}>
                  Post reply
                </Button>
              </div>
            )}
          </div>
        ))}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
