import { useState } from "react";
import {
  ExternalLink,
  Layers,
  Package,
  Star,
  Store,
  Tag,
  TrendingDown,
  Users,
} from "lucide-react";
import type { Product } from "@/types/shopping";
import { formatPrice, getDomain, truncate } from "@/lib/format";
import { RatingStars } from "@/components/RatingStars";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  index?: number;
  highlights?: string[];
}

function ProductIllustration({ name, brand }: { name: string; brand: string }) {
  // Deterministic gradient based on the product name.
  const hue = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const initials = (brand && brand !== "N/A" ? brand : name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div
      className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-xl"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 70% 92%) 0%, hsl(${(hue + 40) % 360} 80% 88%) 100%)`,
      }}
      aria-hidden="true"
    >
      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/40 blur-xl" />
      <div className="absolute -left-4 bottom-2 h-20 w-20 rounded-full bg-white/30 blur-lg" />
      <span
        className="relative font-display text-3xl font-bold tracking-tight"
        style={{ color: `hsl(${hue} 60% 28%)` }}
      >
        {initials || "★"}
      </span>
    </div>
  );
}

function ProductMedia({
  name,
  brand,
  image,
}: {
  name: string;
  brand: string;
  image?: string | null;
}) {
  const [broken, setBroken] = useState(false);
  const src = image?.trim();
  if (src && !broken) {
    return (
      <div className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-xl bg-muted/80 dark:bg-white/90">
        <img
          src={src}
          alt=""
          className="max-h-full max-w-full object-contain p-2"
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
        />
      </div>
    );
  }
  return <ProductIllustration name={name} brand={brand} />;
}

export function ProductCard({ product, index = 0, highlights }: ProductCardProps) {
  const hasLink = Boolean(product.link);
  const inStock =
    product.availability &&
    !/unknown|out of stock|unavailable/i.test(product.availability);

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-4 rounded-2xl border border-border bg-gradient-card p-4 shadow-card transition-base hover:-translate-y-1 hover:shadow-hover animate-fade-in-up",
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <ProductMedia name={product.name} brand={product.brand} image={product.image} />

      <div className="flex flex-1 flex-col gap-3">
        {highlights && highlights.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-1.5"
            title="Among the results shown"
          >
            {highlights.map((tag) => {
              const Icon =
                tag === "Lowest price"
                  ? TrendingDown
                  : tag === "Most reviewed"
                    ? Users
                    : Star;
              return (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                  title="Among the results shown"
                >
                  <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {tag}
                </span>
              );
            })}
          </div>
        )}

        <header className="flex flex-col gap-1">
          {product.brand && product.brand !== "N/A" && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              {product.brand}
            </span>
          )}
          <h3 className="line-clamp-2 font-display text-base font-semibold leading-snug text-foreground">
            {product.name}
          </h3>
        </header>

        <RatingStars rating={product.rating} reviews={product.reviews} />

        {product.features && (
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {truncate(product.features, 180)}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {product.over_budget && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 font-medium text-destructive">
              Over budget
            </span>
          )}
          {product.store && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
              <Store className="h-3 w-3" />
              {product.store}
            </span>
          )}
          {product.discount && product.discount !== "N/A" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 font-medium text-accent">
              <Tag className="h-3 w-3" />
              {product.discount}
            </span>
          )}
          {product.variant_count && product.variant_count > 1 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-primary"
              title={`Available in ${product.variant_count} variants (colors or sizes)`}
              aria-label={`Available in ${product.variant_count} variants (colors or sizes)`}
            >
              <Layers className="h-3 w-3" />
              {product.variant_count} variants
            </span>
          )}
          {product.availability && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1",
                inStock
                  ? "bg-success/10 text-success"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Package className="h-3 w-3" />
              {product.availability}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <div>
            <div className="flex items-baseline gap-2">
              <div className="font-display text-2xl font-bold tracking-tight text-foreground">
                {formatPrice(product.price)}
              </div>
              {product.original_price && product.discount_percent ? (
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(product.original_price)}
                </span>
              ) : null}
            </div>
            {hasLink && (
              <div className="text-[11px] text-muted-foreground">
                from {getDomain(product.link)}
              </div>
            )}
          </div>

          {hasLink ? (
            <Button asChild variant="primaryGradient" size="sm">
              <a href={product.link} target="_blank" rel="noopener noreferrer">
                View deal
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          ) : (
            <Button variant="soft" size="sm" disabled>
              No link
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
