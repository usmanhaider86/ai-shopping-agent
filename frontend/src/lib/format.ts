/** Format a numeric price with a best-guess currency. */
export function formatPrice(price: number | null, currencyHint?: string): string {
  if (price === null || Number.isNaN(price) || price <= 0) return "Check price at store";
  const currency = (currencyHint || guessCurrencyFromContext() || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: price % 1 === 0 ? 0 : 2,
    }).format(price);
  } catch {
    return `${currency} ${price.toLocaleString()}`;
  }
}

function guessCurrencyFromContext(): string | undefined {
  if (typeof navigator === "undefined") return undefined;
  const lang = navigator.language || "en-US";
  if (lang.includes("PK")) return "PKR";
  if (lang.includes("IN")) return "INR";
  if (lang.includes("GB")) return "GBP";
  if (lang.startsWith("de") || lang.startsWith("fr") || lang.startsWith("es")) return "EUR";
  return undefined;
}

/** Truncate a string to n chars, suffixing an ellipsis. */
export function truncate(text: string, max = 140): string {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Get domain from a URL for compact display. */
export function getDomain(url: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
