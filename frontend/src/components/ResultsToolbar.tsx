import { useId } from "react";
import { ArrowUpDown, RotateCcw, SlidersHorizontal, Star, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type SortKey = "best" | "price-asc" | "price-desc" | "rating" | "discount-desc";

export interface ResultsToolbarProps {
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  minRating: number | null;
  onMinRatingChange: (rating: number | null) => void;
  stores: string[];
  selectedStore: string | null;
  onStoreChange: (store: string | null) => void;
  hideOverBudget: boolean;
  onHideOverBudgetChange: (hide: boolean) => void;
  showOverBudgetToggle: boolean;
  shownCount: number;
  totalCount: number;
  onClear: () => void;
}

const RATING_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Any", value: null },
  { label: "4+ stars", value: 4 },
  { label: "3+ stars", value: 3 },
];

export function ResultsToolbar({
  sort,
  onSortChange,
  minRating,
  onMinRatingChange,
  stores,
  selectedStore,
  onStoreChange,
  hideOverBudget,
  onHideOverBudgetChange,
  showOverBudgetToggle,
  shownCount,
  totalCount,
  onClear,
}: ResultsToolbarProps) {
  const sortId = useId();
  const switchId = useId();

  const isFilteredOrSorted =
    sort !== "best" ||
    minRating !== null ||
    selectedStore !== null ||
    hideOverBudget;

  return (
    <section
      aria-label="Product filters and sorting"
      className="mb-6 rounded-2xl border border-border bg-card/70 p-4 shadow-card backdrop-blur-sm"
    >
      <div className="flex flex-col gap-4">
        {/* Top bar: Sort & Over-budget toggle & Primary actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3.5">
          <div className="flex flex-wrap items-center gap-4">
            {/* Sort Control */}
            <div className="flex items-center gap-2">
              <Label
                htmlFor={sortId}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground whitespace-nowrap"
              >
                <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
                Sort by:
              </Label>
              <Select
                value={sort}
                onValueChange={(val) => onSortChange(val as SortKey)}
              >
                <SelectTrigger
                  id={sortId}
                  aria-label="Sort products by"
                  className="h-8.5 w-[175px] rounded-lg border-input bg-background text-xs font-medium shadow-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-popover shadow-card">
                  <SelectItem value="best" className="text-xs">
                    Best match
                  </SelectItem>
                  <SelectItem value="price-asc" className="text-xs">
                    Price: low to high
                  </SelectItem>
                  <SelectItem value="price-desc" className="text-xs">
                    Price: high to low
                  </SelectItem>
                  <SelectItem value="rating" className="text-xs">
                    Rating: high to low
                  </SelectItem>
                  <SelectItem value="discount-desc" className="text-xs">
                    Discount: high to low
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Hide Over-Budget Switch (conditionally shown) */}
            {showOverBudgetToggle && (
              <div className="flex items-center gap-2 border-l border-border/60 pl-4">
                <Switch
                  id={switchId}
                  checked={hideOverBudget}
                  onCheckedChange={onHideOverBudgetChange}
                  aria-label="Hide over-budget products"
                />
                <Label
                  htmlFor={switchId}
                  className="cursor-pointer text-xs font-medium text-foreground transition-colors hover:text-primary"
                >
                  Hide over-budget
                </Label>
              </div>
            )}
          </div>

          {/* Result Count and Clear Filters Button */}
          <div className="flex items-center gap-3">
            <div
              aria-live="polite"
              aria-atomic="true"
              className="text-xs font-medium text-muted-foreground"
            >
              Showing <span className="font-semibold text-foreground">{shownCount}</span> of{" "}
              <span className="font-semibold text-foreground">{totalCount}</span>
            </div>

            {isFilteredOrSorted && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="h-8 rounded-lg px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <RotateCcw className="mr-1.5 h-3 w-3" />
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Filters section: Min Rating & Store Chips */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
          {/* Rating filter chips */}
          <div
            role="group"
            aria-label="Filter by minimum rating"
            className="flex items-center gap-2"
          >
            <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground whitespace-nowrap">
              <Star className="h-3.5 w-3.5 text-rating fill-rating/20" />
              Rating:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {RATING_OPTIONS.map((opt) => {
                const isSelected = minRating === opt.value;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onMinRatingChange(opt.value)}
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:bg-card hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Store filter chips */}
          {stores.length > 0 && (
            <div
              role="group"
              aria-label="Filter by store"
              className="flex items-center gap-2 overflow-hidden"
            >
              <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                <Store className="h-3.5 w-3.5 text-primary" />
                Store:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
                <button
                  type="button"
                  aria-pressed={selectedStore === null}
                  onClick={() => onStoreChange(null)}
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    selectedStore === null
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:bg-card hover:text-foreground",
                  )}
                >
                  All stores
                </button>
                {stores.map((s) => {
                  const isSelected = selectedStore === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onStoreChange(s)}
                      className={cn(
                        "inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "border border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:bg-card hover:text-foreground",
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
