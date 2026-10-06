import { ArrowRight, Loader2, Mic, MicOff, Search, Sparkles } from "lucide-react";
import { useCallback, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const MAX = 500;

const SUGGESTIONS = [
  "Best wireless headphones under $100",
  "Lightweight gaming laptop, RTX 4060, under $1500",
  "Smartphone under 50000 PKR with great camera",
  "Quiet espresso machine for small kitchen",
];

interface SearchHeroProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  hasResults: boolean;
}

export function SearchHero({ value, onChange, onSubmit, isLoading, hasResults }: SearchHeroProps) {
  const inputId = useId();
  const { toast } = useToast();

  /** Snapshot of the input text at the moment the mic was started. */
  const baseTextRef = useRef<string>("");

  const handleResult = useCallback(
    (sessionText: string) => {
      const base = baseTextRef.current;
      const combined = (base ? base.trimEnd() + " " : "") + sessionText;
      onChange(combined.trim().slice(0, MAX));
    },
    [onChange],
  );

  const handleError = useCallback(
    (message: string) => {
      toast({
        title: "Voice Search Error",
        description: message,
        variant: "destructive",
      });
    },
    [toast],
  );

  // Stable reference object so the hook never sees a new options identity
  const stableOptions = useRef({ onResult: handleResult, onError: handleError });
  stableOptions.current.onResult = handleResult;
  stableOptions.current.onError = handleError;

  const { isSupported, isListening, start: startMic, stop } = useSpeechRecognition(stableOptions.current);

  const start = useCallback(() => {
    baseTextRef.current = value;
    startMic();
  }, [value, startMic]);

  const remaining = MAX - value.length;
  const tooLong = value.length > MAX;
  const tooShort = value.trim().length === 0;
  const disabled = isLoading || tooShort || tooLong;

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden border-b border-border/60"
    >
      {/* Decorative background */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-hero opacity-[0.08] dark:opacity-20" />
        <div className="absolute -left-32 top-10 h-72 w-72 rounded-full bg-primary/20 blur-3xl animate-float" />
        <div className="absolute -right-20 top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl animate-float [animation-delay:-3s]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div className={cn("container py-14 sm:py-20", hasResults && "py-10 sm:py-12")}>
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft animate-fade-in">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Powered by an AI agent across multiple sources
          </span>

          <h1
            id="hero-heading"
            className="mt-5 font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl animate-fade-in-up"
          >
            Shop smarter with an{" "}
            <span className="bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
              AI agent
            </span>{" "}
            that finds the best deals for you.
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground text-balance animate-fade-in-up [animation-delay:80ms]">
            Describe what you want in plain English — budget, brand, features.
            We'll rank options and surface the best choice.
          </p>

          <form
            className="mt-8 animate-fade-in-up [animation-delay:160ms]"
            onSubmit={(e) => {
              e.preventDefault();
              if (!disabled) onSubmit();
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              What are you shopping for?
            </label>

            <div
              className={cn(
                "group relative flex flex-col items-stretch gap-2 rounded-2xl border border-border bg-card p-2 shadow-card transition-base focus-within:border-primary/60 focus-within:shadow-hover sm:flex-row sm:items-center sm:gap-0 sm:rounded-full sm:p-1.5",
                tooLong && "border-destructive/60 focus-within:border-destructive",
              )}
            >
              <Search className="ml-3 hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" />
              <input
                id={inputId}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={
                  isListening
                    ? "Listening… speak now"
                    : "e.g. best phone under 50000 PKR with long battery"
                }
                maxLength={MAX + 50}
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none sm:px-2"
                aria-describedby={`${inputId}-help`}
              />

              <div className="flex items-center gap-2 sm:contents">
                {isSupported && (
                  <Button
                    type="button"
                    variant={isListening ? "destructive" : "ghost"}
                    size="icon"
                    disabled={isLoading}
                    onClick={() => (isListening ? stop() : start())}
                    aria-label={isListening ? "Stop voice search" : "Start voice search"}
                    aria-pressed={isListening}
                    className={cn(
                      "shrink-0 rounded-full transition-all sm:mr-1.5",
                      isListening && "animate-pulse-soft",
                    )}
                  >
                    {isListening ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                )}

                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  disabled={disabled}
                  className="flex-1 rounded-xl sm:flex-none sm:rounded-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching…
                    </>
                  ) : (
                    <>
                      Search
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            <span className="sr-only" aria-live="polite" aria-atomic="true">
              {isListening ? "Listening" : "Stopped listening"}
            </span>

            <div
              id={`${inputId}-help`}
              className="mt-2 flex items-center justify-between px-1 text-xs"
            >
              <span className="text-muted-foreground">
                Tip: include budget, brand, and key features. You can also tap the mic and speak.
              </span>
              <span
                className={cn(
                  "tabular-nums text-muted-foreground",
                  remaining < 50 && "text-accent",
                  tooLong && "font-medium text-destructive",
                )}
                aria-live="polite"
              >
                {value.length}/{MAX}
              </span>
            </div>
          </form>

          {!hasResults && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 animate-fade-in-up [animation-delay:240ms]">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange(s)}
                  className="rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground transition-base hover:border-primary/40 hover:bg-card hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
