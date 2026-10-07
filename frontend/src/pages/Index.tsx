import { useCallback, useMemo, useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { SearchResponse, SearchState } from "@/types/shopping";
import { computeHighlights, productKey } from "@/lib/highlights";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SearchHero } from "@/components/SearchHero";
import { ChatReplyCard } from "@/components/ChatReplyCard";
import { ProductCard } from "@/components/ProductCard";
import { BestChoiceCard } from "@/components/BestChoiceCard";
import { SummaryPanel } from "@/components/SummaryPanel";
import { UnderstoodStrip } from "@/components/UnderstoodStrip";
import { BestChoiceSkeleton, ProductSkeleton } from "@/components/Skeletons";
import { EmptyState, ErrorState, IdleState } from "@/components/States";
import { ResultsToolbar, type SortKey } from "@/components/ResultsToolbar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Info } from "lucide-react";

const Index = () => {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [sort, setSort] = useState<SortKey>("best");
  const [minRating, setMinRating] = useState<number | null>(null);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [hideOverBudget, setHideOverBudget] = useState(false);
  const { toast } = useToast();

  const handleClearFilters = useCallback(() => {
    setSort("best");
    setMinRating(null);
    setSelectedStore(null);
    setHideOverBudget(false);
  }, []);

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      if (trimmed.length > 500) {
        toast({
          title: "Query too long",
          description: "Please keep your query under 500 characters.",
          variant: "destructive",
        });
        return;
      }

      // Reset all toolbar controls when starting a new search
      setSort("best");
      setMinRating(null);
      setSelectedStore(null);
      setHideOverBudget(false);

      setState({ status: "loading", query: trimmed });
      try {
        const data: SearchResponse = await api.search({ query: trimmed });
        const isEmpty = !data.products || data.products.length === 0;
        setState({
          status: isEmpty ? "empty" : "success",
          query: trimmed,
          data,
        });
      } catch (err) {
        const apiErr =
          err instanceof ApiError
            ? err
            : new ApiError("An unexpected error occurred.");
        setState({
          status: "error",
          query: trimmed,
          error: apiErr.message,
          code: apiErr.code,
        });
        toast({
          title: "Search failed",
          description: apiErr.message,
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const stores = useMemo(() => {
    if (state.status !== "success") return [];
    const set = new Set<string>();
    for (const p of state.data.products) {
      if (p.store && p.store.trim()) {
        set.add(p.store.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [state]);

  const showOverBudgetToggle = useMemo(() => {
    if (state.status !== "success") return false;
    return state.data.products.some((p) => Boolean(p.over_budget));
  }, [state]);

  const highlights = useMemo(() => {
    if (state.status !== "success") return {};
    return computeHighlights(state.data.products);
  }, [state]);

  const visibleProducts = useMemo(() => {
    if (state.status !== "success") return [];
    let result = [...state.data.products];

    // Filter by min rating (exclude items with null rating when a min is set)
    if (minRating !== null) {
      result = result.filter(
        (p) => typeof p.rating === "number" && p.rating >= minRating,
      );
    }

    // Filter by selected store
    if (selectedStore !== null) {
      result = result.filter((p) => p.store === selectedStore);
    }

    // Filter by hideOverBudget (exclude product.over_budget === true)
    if (hideOverBudget) {
      result = result.filter((p) => !p.over_budget);
    }

    // Sort products
    if (sort === "price-asc") {
      result.sort((a, b) => {
        const aValid = a.price !== null && a.price > 0;
        const bValid = b.price !== null && b.price > 0;
        if (!aValid && !bValid) return 0;
        if (!aValid) return 1;
        if (!bValid) return -1;
        return (a.price as number) - (b.price as number);
      });
    } else if (sort === "price-desc") {
      result.sort((a, b) => {
        const aValid = a.price !== null && a.price > 0;
        const bValid = b.price !== null && b.price > 0;
        if (!aValid && !bValid) return 0;
        if (!aValid) return 1;
        if (!bValid) return -1;
        return (b.price as number) - (a.price as number);
      });
    } else if (sort === "rating") {
      result.sort((a, b) => {
        const aValid = a.rating !== null && a.rating !== undefined;
        const bValid = b.rating !== null && b.rating !== undefined;
        if (!aValid && !bValid) return 0;
        if (!aValid) return 1;
        if (!bValid) return -1;
        return (b.rating as number) - (a.rating as number);
      });
    } else if (sort === "discount-desc") {
      result.sort((a, b) => {
        const aValid =
          a.discount_percent !== null && a.discount_percent !== undefined;
        const bValid =
          b.discount_percent !== null && b.discount_percent !== undefined;
        if (!aValid && !bValid) return 0;
        if (!aValid) return 1;
        if (!bValid) return -1;
        return (b.discount_percent as number) - (a.discount_percent as number);
      });
    }

    return result;
  }, [state, minRating, selectedStore, hideOverBudget, sort]);

  const isLoading = state.status === "loading";
  const hasResults = state.status === "success" || state.status === "empty";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        <SearchHero
          value={query}
          onChange={setQuery}
          onSubmit={() => runSearch(query)}
          isLoading={isLoading}
          hasResults={hasResults || state.status === "error"}
        />

        <section
          aria-live="polite"
          aria-busy={isLoading}
          className="container py-10 sm:py-14"
        >
          {state.status === "idle" && <IdleState />}

          {state.status === "loading" && (
            <div className="space-y-8">
              <BestChoiceSkeleton />
              <div>
                <div className="mb-4 h-5 w-40 rounded bg-muted" aria-hidden="true" />
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <ProductSkeleton key={i} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {state.status === "error" && (
            <ErrorState
              error={state.error}
              onRetry={() => runSearch(state.query)}
            />
          )}

          {state.status === "empty" && (
            <div className="space-y-6">
              {state.data.intent === "chat" ? (
                <ChatReplyCard
                  reply={state.data.message}
                  suggestions={state.data.suggestions}
                  onPick={(q) => {
                    setQuery(q);
                    runSearch(q);
                  }}
                />
              ) : (
                <>
                  <UnderstoodStrip
                    keywords={state.data.keywords}
                    budgetNote={state.data.budget_note}
                  />
                  <EmptyState
                    title={state.data.intent === "unavailable" ? "Product source is busy" : undefined}
                    message={state.data.message || state.data.recommendation}
                    onRetry={() => runSearch(state.query)}
                  />
                </>
              )}
              {state.data.markdown_result && (
                <SummaryPanel markdown={state.data.markdown_result} />
              )}
            </div>
          )}

          {state.status === "success" && (
            <div className="space-y-10">
              <UnderstoodStrip
                keywords={state.data.keywords}
                budgetNote={state.data.budget_note}
              />

              {state.data.best_choice ? (
                <BestChoiceCard
                  product={state.data.best_choice}
                  recommendation={state.data.recommendation}
                />
              ) : (
                state.data.products.length > 0 && (
                  <div
                    role="status"
                    className="rounded-2xl border border-border bg-gradient-card p-4 text-sm font-medium text-foreground shadow-card"
                  >
                    {state.data.recommendation}
                  </div>
                )
              )}

              <div>
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
                      All matches
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {state.data.products.length} ranked result
                      {state.data.products.length === 1 ? "" : "s"} for{" "}
                      <span className="font-medium text-foreground">
                        "{state.query}"
                      </span>
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        Prices shown are US store prices in USD. Shipping, import charges and availability in your country are not included.
                      </span>
                    </p>
                  </div>
                </div>

                <ResultsToolbar
                  sort={sort}
                  onSortChange={setSort}
                  minRating={minRating}
                  onMinRatingChange={setMinRating}
                  stores={stores}
                  selectedStore={selectedStore}
                  onStoreChange={setSelectedStore}
                  hideOverBudget={hideOverBudget}
                  onHideOverBudgetChange={setHideOverBudget}
                  showOverBudgetToggle={showOverBudgetToggle}
                  shownCount={visibleProducts.length}
                  totalCount={state.data.products.length}
                  onClear={handleClearFilters}
                />

                {visibleProducts.length > 0 ? (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleProducts.map((p, i) => {
                      const key = productKey(p);
                      return (
                        <ProductCard
                          key={key}
                          product={p}
                          index={i}
                          highlights={highlights[key]}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center sm:p-12">
                    <p className="text-base font-semibold text-foreground">
                      No products match these filters
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Try adjusting or resetting your filters to see more results.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleClearFilters}
                      className="mt-4 rounded-xl"
                    >
                      Clear filters
                    </Button>
                  </div>
                )}
              </div>

              {state.data.markdown_result && (
                <SummaryPanel markdown={state.data.markdown_result} />
              )}
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Index;
