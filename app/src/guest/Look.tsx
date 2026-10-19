// The restaurant's own look on the guest page (CLAUDE.md 4.4): header, category headings and
// ornaments, plus applying colours, fonts and texture to the whole page.
import { useEffect, useState } from "react";
import {
  brandingImage,
  loadFonts,
  monogram,
  readTheme,
  textureStyle,
  themeVars,
  type Theme,
} from "../lib/theme";

/** Message the dashboard's Look screen sends to its preview frame. */
export interface PreviewMessage {
  type: "mb-look";
  theme: unknown;
  logo_path: string | null;
}

const isPreview = new URLSearchParams(location.search).has("preview");

/**
 * The look to show: the saved one, or, inside the dashboard's preview frame, the draft the
 * owner is editing. Applies it to the whole page (so dialogs and the area around the page match).
 */
export function useGuestLook(saved: unknown, savedLogo: string | null) {
  const [draft, setDraft] = useState<PreviewMessage | null>(null);

  useEffect(() => {
    if (!isPreview || window.parent === window) return;
    const onMessage = (e: MessageEvent) => {
      // Only our own dashboard (same address) may change the preview.
      if (e.origin !== location.origin || e.source !== window.parent) return;
      const data = e.data as Partial<PreviewMessage> | null;
      if (data?.type === "mb-look")
        setDraft({
          type: "mb-look",
          theme: data.theme,
          logo_path: typeof data.logo_path === "string" ? data.logo_path : null,
        });
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "mb-preview-ready" }, location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const theme = readTheme(draft ? draft.theme : saved);
  const logo = draft ? draft.logo_path : savedLogo;
  const key = JSON.stringify(theme);

  useEffect(() => {
    const t = readTheme(JSON.parse(key));
    void loadFonts(t.fonts);
    const root = document.documentElement;
    const vars = themeVars(t);
    for (const [name, value] of Object.entries(vars))
      root.style.setProperty(name, value);
    const texture = textureStyle(t);
    root.style.backgroundImage = texture.backgroundImage ?? "";
    root.style.backgroundSize = texture.backgroundSize ?? "";
    root.style.backgroundAttachment = "fixed";
    return () => {
      for (const name of Object.keys(vars)) root.style.removeProperty(name);
      root.style.backgroundImage = "";
    };
  }, [key]);

  return { theme, logo };
}

const flourish = (
  <svg
    viewBox="0 0 120 16"
    className="h-4 w-28"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M2 8h34c6 0 8-6 14-6s7 6 10 6 4-6 10-6 8 6 14 6h34" />
    <circle cx="60" cy="8" r="1.8" fill="currentColor" stroke="none" />
  </svg>
);

/** Small mark between categories and under the header. */
export function Ornament({
  theme,
  name,
  className = "",
}: {
  theme: Theme;
  name: string;
  className?: string;
}) {
  if (theme.ornament === "none") return null;
  return (
    <div
      className={`text-brand-strong flex justify-center ${className}`}
      aria-hidden="true"
    >
      {theme.ornament === "monogram" ? (
        <span className="border-brand-strong font-display grid size-11 rotate-45 place-items-center rounded-[0.35rem] border">
          <span className="-rotate-45 text-base font-semibold tracking-wide">
            {monogram(name)}
          </span>
        </span>
      ) : theme.ornament === "flourish" ? (
        flourish
      ) : (
        <span className="text-sm tracking-[0.6em]">
          {theme.ornament === "stars" ? "✦ ✦ ✦" : "• • •"}
        </span>
      )}
    </div>
  );
}

export function Hero({
  theme,
  logo,
  name,
  tableText,
  taglineTranslated = null,
}: {
  theme: Theme;
  logo: string | null;
  name: string;
  tableText: string | null;
  /** The published tagline in the guest's language (CLAUDE.md 4.4), if translated. */
  taglineTranslated?: string | null;
}) {
  const logoUrl = brandingImage(logo);
  const cover = brandingImage(theme.cover_path);
  const header = theme.header === "cover" && !cover ? "band" : theme.header;
  const tagline = taglineTranslated || theme.tagline || null;

  if (header === "cover")
    return (
      <div className="relative">
        <img
          src={cover!}
          alt=""
          className="h-[42vh] max-h-80 min-h-52 w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-2xl px-4 pb-4 text-white">
          {logoUrl && (
            <img
              src={logoUrl}
              alt=""
              className="rounded-control mb-3 max-h-16 max-w-40 bg-white/90 object-contain p-1.5"
            />
          )}
          <h1 className="text-3xl leading-tight font-semibold" dir="auto">
            {name}
          </h1>
          {tagline && (
            <p className="mt-1 text-white/90" dir="auto">
              {tagline}
            </p>
          )}
          {tableText && (
            <p className="mt-2 inline-block rounded-full bg-white/20 px-3 py-0.5 text-sm font-semibold backdrop-blur">
              {tableText}
            </p>
          )}
        </div>
      </div>
    );

  if (header === "band")
    return (
      <div className="bg-brand text-on-brand">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-6">
          {logoUrl && (
            <img
              src={logoUrl}
              alt=""
              className="rounded-control size-16 shrink-0 bg-white object-contain p-1.5"
            />
          )}
          <div className="min-w-0">
            <h1 className="text-3xl leading-tight font-semibold" dir="auto">
              {name}
            </h1>
            {tagline && (
              <p className="mt-1 opacity-90" dir="auto">
                {tagline}
              </p>
            )}
            {tableText && (
              <p className="mt-1.5 text-sm font-semibold opacity-90">
                {tableText}
              </p>
            )}
          </div>
        </div>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl px-4 pt-7 pb-3 text-center">
      {logoUrl && (
        <img
          src={logoUrl}
          alt=""
          className="mx-auto mb-3 max-h-20 max-w-[60%] object-contain"
        />
      )}
      <h1 className="text-3xl leading-tight font-semibold" dir="auto">
        {name}
      </h1>
      {tagline && (
        <p className="text-ink-muted mt-1 italic" dir="auto">
          {tagline}
        </p>
      )}
      {tableText && (
        <p className="bg-surface-muted mt-2 inline-block rounded-full px-3 py-0.5 text-sm font-semibold">
          {tableText}
        </p>
      )}
      <Ornament theme={theme} name={name} className="mt-4" />
    </div>
  );
}

export function CategoryHeading({
  theme,
  id,
  name,
  translated,
}: {
  theme: Theme;
  id: string;
  name: string;
  translated: string | null;
}) {
  const original = translated && (
    <span
      className="text-ink-muted mt-0.5 block font-sans text-sm font-medium tracking-normal normal-case"
      dir="auto"
    >
      {name}
    </span>
  );
  if (theme.headings === "centered")
    return (
      <h2 id={id} className="text-center">
        <span className="flex items-center gap-3">
          <span className="bg-line h-px flex-1" aria-hidden="true" />
          <span
            className="text-xl font-semibold tracking-[0.14em] uppercase"
            dir="auto"
          >
            {translated ?? name}
          </span>
          <span className="bg-line h-px flex-1" aria-hidden="true" />
        </span>
        {original}
      </h2>
    );
  if (theme.headings === "lined")
    return (
      <h2 id={id}>
        <span className="text-2xl font-semibold" dir="auto">
          {translated ?? name}
        </span>
        {original}
        <span
          className="bg-brand mt-2 block h-1 w-12 rounded-full"
          aria-hidden="true"
        />
      </h2>
    );
  return (
    <h2 id={id} className="text-2xl font-semibold">
      <span dir="auto">{translated ?? name}</span>
      {original}
    </h2>
  );
}
