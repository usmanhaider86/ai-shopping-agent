export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-card/40 mt-16">
      <div className="container flex flex-col items-center justify-between gap-3 py-6 text-xs text-muted-foreground sm:flex-row">
        <p>
          © {new Date().getFullYear()} AI Shopping Agent. Built with a FastAPI
          backend.
        </p>
        <p>
          Prices are Amazon US prices in USD and may differ in your country; results may vary in accuracy.
        </p>
      </div>
    </footer>
  );
}
