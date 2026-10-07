import { AlertCircle, PackageSearch, RefreshCw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function IdleState() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-card">
        <PackageSearch className="h-6 w-6" />
      </div>
      <h2 className="mt-4 font-display text-xl font-semibold">
        Start with a question
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Ask in your own words — the AI will hunt across sources, rank options, and
        highlight the best choice for your budget.
      </p>
    </div>
  );
}

export function EmptyState({
  title,
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card px-6 py-12 text-center shadow-soft animate-fade-in">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <SearchX className="h-6 w-6" />
      </div>
      <h2 className="mt-4 font-display text-xl font-semibold">
        {title || "No matching products found"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {message ||
          "We couldn't find reliable data for that query right now. Try simpler keywords or adjust your budget."}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </Button>
      )}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-3xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center shadow-soft animate-fade-in"
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h2 className="mt-4 font-display text-lg font-semibold">
        Something went wrong
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-foreground/80">{error}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
