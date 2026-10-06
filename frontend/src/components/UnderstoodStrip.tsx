import { Sparkles, Wallet } from "lucide-react";

export interface UnderstoodStripProps {
  keywords?: string[];
  budgetNote?: string;
}

export function UnderstoodStrip({ keywords, budgetNote }: UnderstoodStripProps) {
  const validKeywords = (keywords || [])
    .filter((k) => typeof k === "string" && k.trim().length > 0)
    .slice(0, 6);
  const trimmedBudget = budgetNote?.trim();

  if (validKeywords.length === 0 && !trimmedBudget) {
    return null;
  }

  return (
    <aside
      role="note"
      aria-label="How your search was understood"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-card/60 px-4 py-3 text-xs text-foreground shadow-soft backdrop-blur-sm"
    >
      <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
        <Sparkles className="h-4 w-4 text-accent shrink-0" aria-hidden="true" />
        <span>Here's how I understood your request</span>
      </div>

      {validKeywords.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">Looking for:</span>
          {validKeywords.map((kw, idx) => (
            <span
              key={`${kw}-${idx}`}
              className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 font-medium text-foreground"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {trimmedBudget ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 font-medium text-foreground">
          <Wallet className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>Budget: {trimmedBudget}</span>
        </span>
      ) : null}
    </aside>
  );
}
