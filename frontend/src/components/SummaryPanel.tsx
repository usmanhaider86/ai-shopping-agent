import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryPanelProps {
  markdown: string;
  defaultOpen?: boolean;
}

export function SummaryPanel({ markdown, defaultOpen = false }: SummaryPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  if (!markdown?.trim()) return null;

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card animate-fade-in">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left transition-base hover:bg-muted/50"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
            <FileText className="h-4 w-4" />
          </span>
          <div>
            <div className="font-display text-sm font-semibold text-foreground">
              AI summary
            </div>
            <div className="text-xs text-muted-foreground">
              Full narrative breakdown of the agent's reasoning
            </div>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-base",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="border-t border-border px-5 py-5 animate-fade-in">
          <div className="prose-shopping max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </div>
        </div>
      )}
    </section>
  );
}
