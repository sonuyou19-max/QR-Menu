/** Languages an owner can choose. Names are shown via Intl.DisplayNames in the dashboard language. */
export const menuLanguages = ["nl", "fr", "en", "de", "it", "es"] as const;
export const guestLanguageOptions = [
  "en",
  "fr",
  "nl",
  "de",
  "es",
  "it",
  "pt",
  "pl",
  "zh",
  "ja",
  "ko",
  "ar",
] as const;
export const defaultGuestLanguages = ["en", "fr", "nl", "de"];

export function languageName(code: string, inLanguage: string): string {
  try {
    const name =
      new Intl.DisplayNames([inLanguage], { type: "language" }).of(code) ??
      code;
    return name.charAt(0).toLocaleUpperCase(inLanguage) + name.slice(1);
  } catch {
    return code.toUpperCase();
  }
}

/** "Brasserie L'Étoile d'Or" → "brasserie-l-etoile-d-or" (matches the database slug rule). */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const isValidSlug = (s: string) =>
  SLUG_RE.test(s) && s.length >= 3 && s.length <= 60;
