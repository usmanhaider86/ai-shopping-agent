export function ProductSkeleton() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-soft"
      aria-hidden="true"
    >
      <div className="h-40 w-full rounded-xl bg-muted" />
      <div className="mt-4 space-y-3">
        <div className="h-3 w-20 rounded bg-muted" />
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-5/6 rounded bg-muted" />
        <div className="flex items-center justify-between pt-2">
          <div className="h-7 w-24 rounded bg-muted" />
          <div className="h-9 w-24 rounded-md bg-muted" />
        </div>
      </div>
      {/* shimmer */}
      <div className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-foreground/5 to-transparent" />
    </div>
  );
}

export function BestChoiceSkeleton() {
  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-card"
      aria-hidden="true"
    >
      <div className="space-y-4">
        <div className="h-3 w-32 rounded bg-muted" />
        <div className="h-8 w-2/3 rounded bg-muted" />
        <div className="h-10 w-40 rounded bg-muted" />
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-4/5 rounded bg-muted" />
        <div className="h-12 w-44 rounded-xl bg-muted" />
      </div>
      <div className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-foreground/5 to-transparent" />
    </div>
  );
}
