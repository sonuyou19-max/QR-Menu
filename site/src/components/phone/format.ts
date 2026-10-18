import type { GuestLang } from "../../data/sample-menu";

const guestLocales: Record<GuestLang, string> = {
  en: "en-IE",
  fr: "fr-BE",
  de: "de-BE",
};

export function guestPrice(lang: GuestLang, amount: number): string {
  return new Intl.NumberFormat(guestLocales[lang], {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount);
}
