import type { Product } from "@/types/shopping";

export function productKey(p: Product): string {
  return `${p.link || p.name}-${p.store || ""}`;
}

export function parseReviewCount(reviews: string | undefined | null): number {
  if (!reviews) return 0;
  const digits = String(reviews).replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

export function computeHighlights(products: Product[]): Record<string, string[]> {
  if (!products || products.length < 3) {
    return {};
  }

  // 1. Lowest price (price > 0)
  const productsWithPrice = products.filter(
    (p): p is Product & { price: number } =>
      typeof p.price === "number" && p.price > 0,
  );
  let minPrice: number | null = null;
  if (productsWithPrice.length > 0) {
    minPrice = Math.min(...productsWithPrice.map((p) => p.price));
  }

  // 2. Most reviewed (reviews count > 0)
  const productReviewCounts = products.map((p) => ({
    key: productKey(p),
    count: parseReviewCount(p.reviews),
  }));
  const positiveReviewCounts = productReviewCounts.filter((r) => r.count > 0);
  let maxReviews: number | null = null;
  if (positiveReviewCounts.length > 0) {
    maxReviews = Math.max(...positiveReviewCounts.map((r) => r.count));
  }

  // 3. Top rated (rating among products with at least 100 reviews)
  const productsWithMin100Reviews = products.filter(
    (p): p is Product & { rating: number } =>
      typeof p.rating === "number" && parseReviewCount(p.reviews) >= 100,
  );
  let maxRating: number | null = null;
  if (productsWithMin100Reviews.length > 0) {
    maxRating = Math.max(...productsWithMin100Reviews.map((p) => p.rating));
  }

  // Assign tags with priority: Lowest price, Most reviewed, Top rated (max 2)
  const highlights: Record<string, string[]> = {};

  for (const p of products) {
    const key = productKey(p);
    const tags: string[] = [];

    if (minPrice !== null && p.price === minPrice) {
      tags.push("Lowest price");
    }

    const count = parseReviewCount(p.reviews);
    if (maxReviews !== null && count === maxReviews && count > 0) {
      tags.push("Most reviewed");
    }

    if (
      maxRating !== null &&
      count >= 100 &&
      typeof p.rating === "number" &&
      p.rating === maxRating
    ) {
      tags.push("Top rated");
    }

    highlights[key] = tags.slice(0, 2);
  }

  return highlights;
}
