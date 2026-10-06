import { Crown, ExternalLink, Sparkles, Tag } from "lucide-react";
import type { Product } from "@/types/shopping";
import { formatPrice, getDomain, truncate } from "@/lib/format";
import { RatingStars } from "@/components/RatingStars";
import { Button } from "@/components/ui/button";

interface BestChoiceCardProps {
  product: Product;
  recommendation?: string;
}

export function BestChoiceCard({ product, recommendation }: BestChoiceCardProps) {
  const hasLink = Boolean(product.link);

  return (
    <section
      aria-labelledby="best-choice-heading"
      className="relative overflow-hidden rounded-3xl border border-accent/30 bg-gradient-best p-1 shadow-best animate-fade-in-up"
    >
      <div className="relative rounded-[calc(var(--radius)+8px)] bg-card/90 p-6 backdrop-blur-sm sm:p-8">
        {/* Ribbon */}
        <div className="absolute right-6 top-6">
          <span className="relative inline-flex items-center gap-1.5 rounded-full bg-gradient-accent px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-accent-foreground shadow-card animate-pulse-soft">
            <Crown className="h-3.5 w-3.5" />
            Best choice
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
          <Sparkles className="h-3.5 w-3.5" />
          AI recommendation
        </div>

        <h2
          id="best-choice-heading"
          className="mt-3 max-w-3xl font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl"
        >
          {product.name}
        </h2>

        {product.brand && product.brand !== "N/A" && (
          <p className="mt-1 text-sm font-medium text-primary">{product.brand}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-baseline gap-2">
            <div className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {formatPrice(product.price)}
            </div>
            {product.original_price && product.discount_percent ? (
              <span className="text-base font-normal text-muted-foreground line-through sm:text-lg">
                {formatPrice(product.original_price)}
              </span>
            ) : null}
          </div>
          {product.discount && product.discount !== "N/A" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
              <Tag className="h-3 w-3" />
              {product.discount}
            </span>
          )}
          <RatingStars rating={product.rating} reviews={product.reviews} size="md" />
          {product.store && (
            <span className="text-sm text-muted-foreground">
              at <span className="font-medium text-foreground">{product.store}</span>
            </span>
          )}
        </div>

        {(recommendation || product.features) && (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground/80">
            {recommendation
              ? recommendation.replace(/^BEST CHOICE:\s*/i, "")
              : truncate(product.features, 240)}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {hasLink ? (
            <Button asChild variant="hero" size="lg">
              <a href={product.link} target="_blank" rel="noopener noreferrer">
                View this deal
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          ) : (
            <Button variant="soft" size="lg" disabled>
              No external link available
            </Button>
          )}
          {hasLink && (
            <span className="text-xs text-muted-foreground">
              Opens {getDomain(product.link)} in a new tab
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
