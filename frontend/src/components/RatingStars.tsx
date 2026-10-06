import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  rating: number | null;
  reviews?: string;
  className?: string;
  size?: "sm" | "md";
}

export function RatingStars({ rating, reviews, className, size = "sm" }: RatingStarsProps) {
  if (rating === null || Number.isNaN(rating)) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>No ratings yet</span>
    );
  }
  const clamped = Math.max(0, Math.min(5, rating));
  const full = Math.floor(clamped);
  const hasHalf = clamped - full >= 0.25 && clamped - full < 0.75;
  const totalFilled = hasHalf ? full + 0.5 : Math.round(clamped);
  const dim = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <div className={cn("flex items-center gap-1.5", className)} aria-label={`Rated ${clamped} out of 5`}>
      <div className="flex items-center" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => {
          const filled = i + 1 <= totalFilled;
          const half = !filled && i + 0.5 === totalFilled;
          return (
            <Star
              key={i}
              className={cn(
                dim,
                filled
                  ? "fill-rating text-rating"
                  : half
                    ? "fill-rating/50 text-rating"
                    : "text-muted-foreground/40",
              )}
            />
          );
        })}
      </div>
      <span className="text-xs font-medium text-foreground/80">{clamped.toFixed(1)}</span>
      {reviews && reviews !== "N/A" && (
        <span className="text-xs text-muted-foreground">({reviews})</span>
      )}
    </div>
  );
}
