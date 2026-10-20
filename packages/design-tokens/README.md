# @menubuddy/design-tokens

Brisolo's brand tokens, shared by `/site` (Astro) and `/app` (React + Vite) so both look like one brand.

- `src/tokens.ts` — **source of truth**: palette, semantic colours, fonts, radius, shadows, contrast pairs.
- `theme.css` — **generated** Tailwind v4 `@theme` block. Don't edit; run `npm run build:tokens` from the repo root.
- `fonts.css` — self-hosted Fraunces (display) + DM Sans (body) via Fontsource. No Google Fonts CDN (GDPR).
- `assets/logo-mark.svg` — placeholder logo mark until the final name is chosen.

## Use in a Tailwind v4 project

```css
/* src/styles/global.css */
@import "tailwindcss";
@import "@menubuddy/design-tokens/fonts.css";
@import "@menubuddy/design-tokens/theme.css";
```

This gives utilities like `bg-canvas`, `text-ink`, `text-ink-muted`, `bg-brand`, `text-on-brand`,
`border-line`, `bg-accent`, `font-display`, `rounded-card`, `shadow-phone`, plus the raw scales
(`bg-paprika-100`, `text-herb-700`, …). Prefer the semantic names in components.

In TypeScript: `import { semantic, themeColor } from "@menubuddy/design-tokens";`

## Changing a token

1. Edit `src/tokens.ts`.
2. `npm run build:tokens` — regenerates `theme.css` and fails if any pair in `contrastPairs` drops below WCAG AA (4.5:1).
3. Commit both files. `npm run check` fails if `theme.css` is stale.
