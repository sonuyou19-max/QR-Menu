/**
 * MenuBuddy brand tokens — the single source of truth for the marketing site
 * and the admin app. `npm run build` turns this file into `theme.css`
 * (a Tailwind v4 `@theme` block) and fails if a text/background pair
 * listed in `contrastPairs` misses WCAG AA.
 *
 * Restaurant guest-menu themes (CLAUDE.md 4.4) are separate, per-restaurant
 * tokens; these are only MenuBuddy's own brand.
 */

/** Warm, food-first palette: paprika (brand), mustard (accent), herb (in stock / success), oat (warm neutrals). */
export const palette = {
  paprika: {
    50: "#fdf3ee",
    100: "#fbe3d6",
    200: "#f6c3a8",
    300: "#ee9a72",
    400: "#e2703f",
    500: "#cf5223",
    600: "#b4401a",
    700: "#923217",
    800: "#722815",
    900: "#4f1c10",
  },
  mustard: {
    50: "#fef8e7",
    100: "#fcedc2",
    200: "#f8db86",
    300: "#f2c64f",
    400: "#e8af2a",
    500: "#cc921a",
    600: "#a87314",
    700: "#835812",
    800: "#5f4010",
    900: "#3e2a0b",
  },
  herb: {
    50: "#f1f6ef",
    100: "#ddead8",
    200: "#b9d3b0",
    300: "#8db57f",
    400: "#63955a",
    500: "#467a3f",
    600: "#386332",
    700: "#2c4e28",
    800: "#213b1f",
    900: "#162815",
  },
  oat: {
    50: "#fbf7f1",
    100: "#f4ede2",
    200: "#e8dccb",
    300: "#d6c5ae",
    400: "#b8a48a",
    500: "#96826a",
    600: "#76654f",
    700: "#5a4c3c",
    800: "#3d332a",
    900: "#241e19",
    950: "#17130f",
  },
} as const;

/** Role-based colours. Components should prefer these over raw palette steps. */
export const semantic = {
  canvas: palette.oat[50], // page background
  surface: "#ffffff", // cards, sheets
  "surface-muted": palette.oat[100],
  ink: palette.oat[900], // body text
  "ink-muted": palette.oat[600], // secondary text
  line: palette.oat[200], // borders, dividers
  brand: palette.paprika[600], // primary buttons, links
  "brand-strong": palette.paprika[700], // hover / pressed
  "on-brand": "#ffffff", // text on brand
  accent: palette.mustard[400], // highlights, badges ("Save 25%")
  "on-accent": palette.oat[900],
  success: palette.herb[600], // "In stock", confirmed allergens
  "on-success": "#ffffff",
  danger: "#b42318", // errors, allergy warnings
  "on-danger": "#ffffff",
} as const;

/** Fonts are self-hosted via Fontsource (see fonts.css) — no Google Fonts CDN, which matters for GDPR in the EU. */
export const fonts = {
  display: `"Fraunces Variable", ui-serif, Georgia, "Times New Roman", serif`,
  sans: `"DM Sans Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`,
} as const;

export const radius = {
  control: "0.75rem", // inputs, small buttons
  card: "1.25rem", // cards, sheets
  phone: "2.75rem", // phone mockup frame
} as const;

export const shadows = {
  card: "0 1px 2px rgb(36 30 25 / 0.06), 0 8px 24px -12px rgb(36 30 25 / 0.18)",
  phone:
    "0 30px 60px -20px rgb(79 28 16 / 0.35), 0 12px 24px -12px rgb(36 30 25 / 0.25)",
} as const;

/** Browser UI colour (`<meta name="theme-color">`). */
export const themeColor = semantic.canvas;

/** Text-on-background pairs that must pass WCAG AA (4.5:1 for normal text). Checked at build time. */
export const contrastPairs: ReadonlyArray<
  readonly [fg: keyof typeof semantic, bg: keyof typeof semantic]
> = [
  ["ink", "canvas"],
  ["ink", "surface"],
  ["ink", "surface-muted"],
  ["ink-muted", "canvas"],
  ["ink-muted", "surface"],
  ["brand", "canvas"],
  ["brand", "surface"],
  ["on-brand", "brand"],
  ["on-brand", "brand-strong"],
  ["on-accent", "accent"],
  ["on-success", "success"],
  ["on-danger", "danger"],
  ["danger", "surface"],
];
