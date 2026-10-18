import nl from "./nl.json";
import fr from "./fr.json";
import en from "./en.json";

export type Dictionary = typeof nl;

// Typing fr/en as `Dictionary` makes `astro check` fail when a key is missing in one language.
const dictionaries: Record<Lang, Dictionary> = { nl, fr, en };

export const languages = ["nl", "fr", "en"] as const;
export type Lang = (typeof languages)[number];
export const defaultLang: Lang = "nl";

/** BCP 47 tags for <html lang>, Intl formatting and hreflang. */
export const locales: Record<Lang, string> = {
  nl: "nl-BE",
  fr: "fr-BE",
  en: "en",
};
/** Open Graph locale codes. */
export const ogLocales: Record<Lang, string> = {
  nl: "nl_BE",
  fr: "fr_BE",
  en: "en_GB",
};

export function getDictionary(lang: Lang): Dictionary {
  return dictionaries[lang];
}

/** Path for `path` (e.g. "/", "/demo") in `lang`. Dutch has no prefix. */
export function localePath(lang: Lang, path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (lang === defaultLang) return clean;
  return clean === "/" ? `/${lang}/` : `/${lang}${clean}`;
}

/** Strip the language prefix from a pathname: "/fr/demo" → "/demo". */
export function unlocalizedPath(pathname: string): string {
  const match = pathname.match(/^\/(fr|en)(\/.*)?$/);
  if (!match) return pathname;
  return match[2] ?? "/";
}

export function formatPrice(lang: Lang, amount: number): string {
  return new Intl.NumberFormat(locales[lang], {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

/** Replace `{name}` placeholders in a translated string. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(
    /\{(\w+)\}/g,
    (_, key: string) => values[key] ?? `{${key}}`,
  );
}
