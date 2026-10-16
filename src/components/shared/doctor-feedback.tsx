"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export function LikeButton({ doctorId, initialLiked, initialCount }: { doctorId: string; initialLiked: boolean; initialCount: number }) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      try {
        const data = liked
          ? await apiClient.delete<{ liked: boolean; likeCount: number }>(`/doctors/${doctorId}/like`)
          : await apiClient.post<{ liked: boolean; likeCount: number }>(`/doctors/${doctorId}/like`);
        setLiked(data.liked);
        setCount(data.likeCount);
        // Saving a doctor is best-effort feedback only: a toast, nothing transmitted.
        toast.success(data.liked ? "Doctor saved" : "Removed from your saved doctors");
      } catch {
        // Likes are best-effort; leave the button as it was.
      }
    });

  return (
    <Button variant="outline" size="sm" className="rounded-lg" disabled={pending} onClick={toggle}>
      <Heart className={`mr-1 h-4 w-4 ${liked ? "fill-current" : ""}`} /> {count}
    </Button>
  );
}

const REVIEW_CATEGORIES = [
  { key: "communicationRating", label: "Communication" },
  { key: "professionalismRating", label: "Professionalism" },
  { key: "punctualityRating", label: "Punctuality" },
  { key: "explanationRating", label: "Explanation" },
] as const;

type CategoryKey = (typeof REVIEW_CATEGORIES)[number]["key"];

export function ReviewForm({ doctorId }: { doctorId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [categories, setCategories] = useState<Record<CategoryKey, number>>({
    communicationRating: 0,
    professionalismRating: 0,
    punctualityRating: 0,
    explanationRating: 0,
  });
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setError("");
      try {
        await apiClient.post(`/doctors/${doctorId}/reviews`, {
          rating,
          comment: comment || undefined,
          // Category ratings are optional; unset ones are simply not recorded.
          communicationRating: categories.communicationRating || undefined,
          professionalismRating: categories.professionalismRating || undefined,
          punctualityRating: categories.punctualityRating || undefined,
          explanationRating: categories.explanationRating || undefined,
        });
        setComment("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save your review");
      }
    });

  return (
    <Card className="beeline-card">
      <CardHeader>
        <CardTitle className="text-base">Rate this doctor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)}>
              <Star className={`h-6 w-6 ${n <= rating ? "fill-current" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
        {REVIEW_CATEGORIES.map((category) => (
          <div key={category.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{category.label}</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${category.label}: ${n} star${n > 1 ? "s" : ""}`}
                  onClick={() => setCategories((c) => ({ ...c, [category.key]: n }))}
                >
                  <Star className={`h-4 w-4 ${n <= categories[category.key] ? "fill-current" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
          </div>
        ))}
        <textarea className="min-h-20 w-full rounded-lg border border-input bg-background p-2 text-sm" maxLength={1000} placeholder="Share your experience (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="bg-foreground text-background rounded-lg" disabled={pending || rating === 0} onClick={submit}>
          Submit review
        </Button>
      </CardContent>
    </Card>
  );
}
