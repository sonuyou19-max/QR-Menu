// A restaurant's own look for its guest menu (CLAUDE.md 4.4). Stored in restaurants.theme.
// A template is only a starting point: every part can be changed on its own, and the
// colours come from the restaurant, so two menus rarely end up alike.
import type { CSSProperties } from "react";
import { config } from "./config";

export const templates = [
  "bistro",
  "trattoria",
  "modern",
  "cafe",
  "fine-dining",
] as const;
export const headers = ["cover", "centered", "band"] as const;
export const layouts = ["list", "cards", "photos"] as const;
export const headingStyles = ["plain", "lined", "centered"] as const;
export const ornaments = [
  "none",
  "monogram",
  "flourish",
  "stars",
  "dots",
] as const;
export const textures = ["plain", "paper", "linen", "grain", "dots"] as const;
export const cornerStyles = ["round", "soft", "square"] as const;

/** Heading + body font pairs, all self-hosted (no Google requests from guests' phones). */
export const fontPairs = {
  house: {
    heading: "Fraunces Variable",
    body: "DM Sans Variable",
    serif: true,
  },
  bistro: {
    heading: "Playfair Display Variable",
    body: "Source Sans 3 Variable",
    serif: true,
  },
  trattoria: {
    heading: "Cormorant Garamond Variable",
    body: "Mulish Variable",
    serif: true,
  },
  elegant: {
    heading: "Cinzel Variable",
    body: "EB Garamond Variable",
    serif: true,
  },
  classic: {
    heading: "Lora Variable",
    body: "Libre Franklin Variable",
    serif: true,
  },
  airy: {
    heading: "Josefin Sans Variable",
    body: "Lora Variable",
    serif: false,
  },
  modern: { heading: "Outfit Variable", body: "Outfit Variable", serif: false },
  urban: {
    heading: "Space Grotesk Variable",
    body: "Work Sans Variable",
    serif: false,
  },
  grill: { heading: "Oswald Variable", body: "Inter Variable", serif: false },
  chalk: { heading: "Caveat Variable", body: "Nunito Variable", serif: false },
} as const;
export type FontPair = keyof typeof fontPairs;

/** CSS for each pair, loaded only when a menu uses it. */
const fontLoaders: Record<FontPair, () => Promise<unknown>> = {
  house: async () => {}, // the app's own fonts, always loaded
  bistro: () =>
    Promise.all([
      import("@fontsource-variable/playfair-display"),
      import("@fontsource-variable/source-sans-3"),
    ]),
  trattoria: () =>
    Promise.all([
      import("@fontsource-variable/cormorant-garamond"),
      import("@fontsource-variable/mulish"),
    ]),
  elegant: () =>
    Promise.all([
      import("@fontsource-variable/cinzel"),
      import("@fontsource-variable/eb-garamond"),
    ]),
  classic: () =>
    Promise.all([
      import("@fontsource-variable/lora"),
      import("@fontsource-variable/libre-franklin"),
    ]),
  airy: () =>
    Promise.all([
      import("@fontsource-variable/josefin-sans"),
      import("@fontsource-variable/lora"),
    ]),
  modern: () => import("@fontsource-variable/outfit"),
  urban: () =>
    Promise.all([
      import("@fontsource-variable/space-grotesk"),
      import("@fontsource-variable/work-sans"),
    ]),
  grill: () =>
    Promise.all([
      import("@fontsource-variable/oswald"),
      import("@fontsource-variable/inter"),
    ]),
  chalk: () =>
    Promise.all([
      import("@fontsource-variable/caveat"),
      import("@fontsource-variable/nunito"),
    ]),
};
export function loadFonts(pair: FontPair): Promise<unknown> {
  return fontLoaders[pair]().catch(() => {}); // system fonts stand in
}

export type Template = (typeof templates)[number];
export interface Theme {
  template: Template;
  fonts: FontPair;
  /** Buttons, prices, ornaments. */
  accent: string;
  /** Page background; text colour follows from it. */
  background: string;
  header: (typeof headers)[number];
  layout: (typeof layouts)[number];
  headings: (typeof headingStyles)[number];
  ornament: (typeof ornaments)[number];
  texture: (typeof textures)[number];
  corners: (typeof cornerStyles)[number];
  /** The restaurant's own line under its name, in its own words. */
  tagline: string;
  /** Cover photo in the "branding" bucket. */
  cover_path: string | null;
}

export const TAGLINE_MAX = 80;

/** Starting points. Colours are suggestions only; the owner's logo should decide them. */
export const presets: Record<
  Template,
  Omit<Theme, "tagline" | "cover_path">
> = {
  bistro: {
    template: "bistro",
    fonts: "bistro",
    accent: "#8c1c13",
    background: "#f6efe2",
    header: "band",
    layout: "list",
    headings: "centered",
    ornament: "flourish",
    texture: "paper",
    corners: "soft",
  },
  trattoria: {
    template: "trattoria",
    fonts: "trattoria",
    accent: "#2f6b3a",
    background: "#fbf5ea",
    header: "cover",
    layout: "cards",
    headings: "lined",
    ornament: "dots",
    texture: "linen",
    corners: "round",
  },
  modern: {
    template: "modern",
    fonts: "modern",
    accent: "#1f3a5f",
    background: "#ffffff",
    header: "centered",
    layout: "photos",
    headings: "plain",
    ornament: "none",
    texture: "plain",
    corners: "square",
  },
  cafe: {
    template: "cafe",
    fonts: "chalk",
    accent: "#d0603f",
    background: "#fff8ef",
    header: "centered",
    layout: "cards",
    headings: "plain",
    ornament: "stars",
    texture: "dots",
    corners: "round",
  },
  "fine-dining": {
    template: "fine-dining",
    fonts: "elegant",
    accent: "#c9a96e",
    background: "#15120f",
    header: "centered",
    layout: "list",
    headings: "centered",
    ornament: "monogram",
    texture: "grain",
    corners: "square",
  },
};

/** A restaurant that hasn't chosen yet keeps MenuBuddy's own look. */
export const defaultTheme: Theme = {
  template: "bistro",
  fonts: "house",
  accent: "#b4401a",
  background: "#fbf7f1",
  header: "centered",
  layout: "list",
  headings: "plain",
  ornament: "none",
  texture: "plain",
  corners: "soft",
  tagline: "",
  cover_path: null,
};

const HEX = /^#[0-9a-f]{6}$/;
const pick = <T extends string>(
  options: readonly T[],
  value: unknown,
  fallback: T,
): T => (options.includes(value as T) ? (value as T) : fallback);

/** Whatever is stored (or sent to a preview), turned into a complete, safe theme. */
export function readTheme(raw: unknown): Theme {
  const t = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const d = defaultTheme;
  const hex = (v: unknown, fallback: string) =>
    typeof v === "string" && HEX.test(v.toLowerCase())
      ? v.toLowerCase()
      : fallback;
  return {
    template: pick(templates, t.template, d.template),
    fonts: pick(Object.keys(fontPairs) as FontPair[], t.fonts, d.fonts),
    accent: hex(t.accent, d.accent),
    background: hex(t.background, d.background),
    header: pick(headers, t.header, d.header),
    layout: pick(layouts, t.layout, d.layout),
    headings: pick(headingStyles, t.headings, d.headings),
    ornament: pick(ornaments, t.ornament, d.ornament),
    texture: pick(textures, t.texture, d.texture),
    corners: pick(cornerStyles, t.corners, d.corners),
    tagline:
      typeof t.tagline === "string"
        ? t.tagline.trim().slice(0, TAGLINE_MAX)
        : "",
    cover_path:
      typeof t.cover_path === "string" && /^[\w-]+\/[\w.-]+$/.test(t.cover_path)
        ? t.cover_path
        : null,
  };
}

// --- Colours (WCAG AA: 4.5:1 for text) ---

type Rgb = [number, number, number];
const toRgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
const toHex = (c: Rgb) =>
  `#${c
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
/** a → b by t (0 = a, 1 = b). */
export const mix = (a: string, b: string, t: number) => {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * t) as Rgb);
};
function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}
/** Move `color` toward `toward` until it reads on `bg` (or reaches `toward`). */
function readable(color: string, bg: string, toward: string, min = 4.5) {
  for (let t = 0; t <= 1; t += 0.05) {
    const c = mix(color, toward, t);
    if (contrast(c, bg) >= min) return c;
  }
  return toward;
}

export function isDark(background: string) {
  return luminance(background) < 0.2;
}

/** The full colour set for a menu, with text colours that always pass AA. */
export function palette(theme: Pick<Theme, "accent" | "background">) {
  const bg = theme.background;
  const dark = isDark(bg);
  const ink = readable(
    mix(bg, dark ? "#ffffff" : "#000000", 0.88),
    bg,
    dark ? "#ffffff" : "#000000",
    7,
  );
  const inkMuted = readable(mix(ink, bg, 0.38), bg, ink);
  const onAccent =
    contrast(theme.accent, "#ffffff") >= contrast(theme.accent, "#16110d")
      ? "#ffffff"
      : "#16110d";
  return {
    canvas: bg,
    surface: dark ? mix(bg, "#ffffff", 0.07) : mix(bg, "#ffffff", 0.65),
    surfaceMuted: mix(bg, ink, dark ? 0.12 : 0.07),
    ink,
    inkMuted,
    line: mix(bg, ink, dark ? 0.22 : 0.14),
    // Buttons: the accent itself, made deeper only if its text can't be read on it.
    brand: readable(
      theme.accent,
      onAccent,
      onAccent === "#ffffff" ? "#000000" : "#ffffff",
      4.5,
    ),
    onBrand: onAccent,
    // Prices, links and ornaments on the page.
    brandText: readable(theme.accent, bg, ink),
    warningText: dark ? "#f2c64f" : "#5f4010",
    dark,
  };
}

const radius = {
  round: { control: "1rem", card: "1.5rem" },
  soft: { control: "0.75rem", card: "1rem" },
  square: { control: "0.25rem", card: "0.375rem" },
};

/** CSS variables that re-colour the shared Tailwind tokens for one menu. */
export function themeVars(theme: Theme): Record<string, string> {
  const p = palette(theme);
  const fonts = fontPairs[theme.fonts];
  const fallback = (serif: boolean) =>
    serif
      ? 'ui-serif, Georgia, "Times New Roman", serif'
      : "ui-sans-serif, system-ui, sans-serif";
  return {
    "--color-canvas": p.canvas,
    "--color-surface": p.surface,
    "--color-surface-muted": p.surfaceMuted,
    "--color-ink": p.ink,
    "--color-ink-muted": p.inkMuted,
    "--color-line": p.line,
    "--color-brand": p.brand,
    "--color-brand-strong": p.brandText,
    "--color-on-brand": p.onBrand,
    "--color-mustard-800": p.warningText,
    "--color-oat-500": p.inkMuted,
    "--font-display": `"${fonts.heading}", ${fallback(fonts.serif)}`,
    "--font-sans": `"${fonts.body}", ui-sans-serif, system-ui, sans-serif`,
    "--radius-control": radius[theme.corners].control,
    "--radius-card": radius[theme.corners].card,
    "color-scheme": p.dark ? "dark" : "light",
  };
}

/** For one element (e.g. a template card in the dashboard). */
export const themeStyle = (theme: Theme) =>
  ({
    ...themeVars(theme),
    background: theme.background,
    ...textureStyle(theme),
  }) as CSSProperties;

/** Subtle background pattern in the text colour, so it works on light and dark menus. */
export function textureStyle(
  theme: Pick<Theme, "texture" | "accent" | "background">,
): {
  backgroundImage?: string;
  backgroundSize?: string;
} {
  const [r, g, b] = toRgb(palette(theme).ink);
  const ink = (a: number) => `rgba(${r},${g},${b},${a})`;
  const noise = (frequency: number, octaves: number, alpha: number) => {
    const c = isDark(theme.background) ? 1 : 0;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${frequency}' numOctaves='${octaves}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${c} 0 0 0 0 ${c} 0 0 0 0 ${c} 0 0 0 ${alpha} 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`;
    return `url("data:image/svg+xml,${svg.replace(/"/g, "'").replace(/</g, "%3C").replace(/>/g, "%3E")}")`;
  };
  switch (theme.texture) {
    case "paper":
      return { backgroundImage: noise(0.035, 3, 0.09) };
    case "grain":
      return { backgroundImage: noise(0.9, 2, 0.14) };
    case "linen":
      return {
        backgroundImage: `repeating-linear-gradient(0deg, ${ink(0.035)} 0 1px, transparent 1px 4px), repeating-linear-gradient(90deg, ${ink(0.03)} 0 1px, transparent 1px 5px)`,
      };
    case "dots":
      return {
        backgroundImage: `radial-gradient(${ink(0.09)} 1.2px, transparent 1.6px)`,
        backgroundSize: "18px 18px",
      };
    default:
      return {};
  }
}

/** Initials for the monogram: "Brasserie De Markt" → "M", "Chez Anna Rossi" → "AR". */
export function monogram(name: string): string {
  const skip = new Set([
    "restaurant",
    "brasserie",
    "bistro",
    "café",
    "cafe",
    "trattoria",
    "taverne",
    "de",
    "het",
    "la",
    "le",
    "les",
    "l",
    "the",
    "da",
    "di",
    "chez",
    "bij",
    "in",
    "t",
  ]);
  const words = name
    .split(/[\s'’-]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  const kept = words.filter((w) => !skip.has(w.toLowerCase()));
  const chosen = (kept.length ? kept : words).slice(0, 2);
  return chosen.map((w) => [...w][0]!.toLocaleUpperCase()).join("") || "•";
}

export const brandingImage = (path: string | null) =>
  path
    ? `${config.supabaseUrl}/storage/v1/object/public/branding/${path}`
    : null;
