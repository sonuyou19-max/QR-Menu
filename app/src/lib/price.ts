/**
 * Read a price as owners type it: "22,50", "22.5", "€ 22,50", "22". Empty → null (no price).
 * Returns undefined when it isn't a valid price.
 */
export function parsePrice(text: string): number | null | undefined {
  const cleaned = text.replace(/[€\s]/g, "").replace(",", ".");
  if (cleaned === "") return null;
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(cleaned)) return undefined;
  return Math.round(Number(cleaned) * 100) / 100;
}

/** Price for an input field, in the owner's notation ("22,50" in nl/fr). */
export function priceInputValue(price: number | null, lang: string): string {
  if (price === null) return "";
  return new Intl.NumberFormat(lang, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(price);
}

export function moneyFormat(lang: string, currency: string) {
  return new Intl.NumberFormat(lang, { style: "currency", currency });
}
