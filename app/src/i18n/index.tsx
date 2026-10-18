import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import nl from "./nl.json";
import fr from "./fr.json";
import en from "./en.json";

export type Dictionary = typeof nl;
export const languages = ["nl", "fr", "en"] as const;
export type Lang = (typeof languages)[number];
export const languageNames: Record<Lang, string> = {
  nl: "Nederlands",
  fr: "Français",
  en: "English",
};

// Typed as Dictionary so a missing key in fr/en fails the type check.
const dictionaries: Record<Lang, Dictionary> = { nl, fr, en };
const STORAGE_KEY = "mb.dashboardLang";

/** Dashboard language (separate from guest languages): saved choice, else the phone's language. */
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (languages as readonly string[]).includes(saved))
      return saved as Lang;
  } catch {
    // Storage blocked (private mode): fall through to the browser language.
  }
  const browser = navigator.language.slice(0, 2);
  return browser === "fr" ? "fr" : browser === "en" ? "en" : "nl";
}

interface I18n {
  lang: Lang;
  t: Dictionary;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not saved; the choice still applies for this visit.
    }
  };
  return (
    <I18nContext.Provider value={{ lang, t: dictionaries[lang], setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n outside I18nProvider");
  return ctx;
}

/** Replace `{name}` placeholders. */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(values[key] ?? `{${key}}`),
  );
}
