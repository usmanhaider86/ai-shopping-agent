import { Sparkles } from "lucide-react";

interface ChatReplyCardProps {
  reply: string;
  suggestions?: string[];
  onPick: (q: string) => void;
}

export function ChatReplyCard({ reply, suggestions, onPick }: ChatReplyCardProps) {
  return (
    <div
      role="status"
      className="mx-auto max-w-2xl animate-fade-in rounded-3xl border border-border bg-card px-6 py-8 shadow-soft"
    >
      <div className="flex items-start gap-4">
        {/* Bot avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-card">
          <Sparkles className="h-5 w-5" />
        </div>

        {/* Reply text */}
        <p className="pt-1.5 text-base leading-relaxed text-foreground">
          {reply}
        </p>
      </div>

      {/* Suggestion chips */}
      {suggestions && suggestions.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2 pl-14">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className="rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground transition-base hover:border-primary/40 hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
