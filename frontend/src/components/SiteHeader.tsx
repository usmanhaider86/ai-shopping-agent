import { ShoppingBag, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";

export function SiteHeader() {
  const [online, setOnline] = useState<"checking" | "ok" | "down">("checking");

  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then(() => !cancelled && setOnline("ok"))
      .catch(() => !cancelled && setOnline("down"));
    return () => {
      cancelled = true;
    };
  }, []);

  const dotClass =
    online === "ok"
      ? "bg-success shadow-[0_0_0_4px_hsl(var(--success)/0.18)]"
      : online === "down"
        ? "bg-destructive shadow-[0_0_0_4px_hsl(var(--destructive)/0.18)]"
        : "bg-muted-foreground/60";

  const label =
    online === "ok" ? "API online" : online === "down" ? "API offline" : "Checking…";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <a href="/" className="group flex items-center gap-2.5">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-card transition-base group-hover:shadow-glow">
            <ShoppingBag className="h-4.5 w-4.5 text-primary-foreground" />
            <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 text-accent" />
          </span>
          <div className="flex flex-col leading-none">
            <span className="font-display text-base font-bold tracking-tight">
              AI Shopping Agent
            </span>
            <span className="text-[11px] text-muted-foreground">Smart picks across the web</span>
          </div>
        </a>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-soft">
            <span className={`h-2 w-2 rounded-full transition-base ${dotClass}`} />
            <span className="hidden sm:inline">{label}</span>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
