// Type definitions matching the FastAPI backend contract.
// See: POST {BASE_URL}/api/shopping/search

export interface SearchRequest {
  /** Natural-language shopping query. 1–500 chars after trim. */
  query: string;
}

export interface Product {
  name: string;
  brand: string;
  price: number | null;
  discount: string;
  original_price?: number | null;
  discount_percent?: number | null;
  features: string;
  rating: number | null;
  reviews: string;
  availability: string;
  store: string;
  source: string;
  link: string;
  /** Product image URL when the catalog provides one (e.g. Amazon search). */
  image?: string | null;
  over_budget?: boolean;
  /** Number of color/size variants merged into this product */
  variant_count?: number;
}

export interface SearchResponse {
  products: Product[];
  best_choice: Product | null;
  recommendation: string;
  message: string;
  markdown_result: string;
  intent?: "shopping" | "chat" | "no_results" | "unavailable" | "error";
  suggestions?: string[];
  budget_note?: string;
  keywords?: string[];
}

export type SearchState =
  | { status: "idle" }
  | { status: "loading"; query: string }
  | { status: "success"; query: string; data: SearchResponse }
  | { status: "empty"; query: string; data: SearchResponse }
  | { status: "error"; query: string; error: string; code?: number };
