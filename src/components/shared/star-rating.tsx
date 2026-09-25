"use client";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  size?: number;
  showValue?: boolean;
  className?: string;
}

export function StarRating({ rating, size = 16, showValue = false, className }: StarRatingProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            style={{ width: size, height: size }}
            className={cn(
              star <= Math.round(rating)
                ? "fill-primary text-primary"
                : "fill-muted text-muted-foreground"
            )}
          />
        ))}
      </div>
      {showValue && (
        <span className="text-sm font-bold text-primary">{rating.toFixed(1)}</span>
      )}
    </div>
  );
}
