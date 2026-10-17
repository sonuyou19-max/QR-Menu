// Generates theme.css from src/tokens.ts and enforces WCAG AA on contrastPairs.
// Runs on plain Node (>= 22.18 strips TypeScript types natively): `node scripts/build.ts [--check]`.
// --check: fail if the committed theme.css is out of date instead of rewriting it.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  contrastPairs,
  fonts,
  palette,
  radius,
  semantic,
  shadows,
} from "../src/tokens.ts";

const outFile = fileURLToPath(new URL("../theme.css", import.meta.url));

function luminance(hex: string): number {
  const channels = hex
    .replace("#", "")
    .match(/../g)!
    .map((h) => parseInt(h, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const [r, g, b] = channels as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

const failures = contrastPairs
  .map(([fg, bg]) => ({ fg, bg, ratio: contrast(semantic[fg], semantic[bg]) }))
  .filter(({ ratio }) => ratio < 4.5);
if (failures.length > 0) {
  for (const { fg, bg, ratio } of failures)
    console.error(`WCAG AA fail: ${fg} on ${bg} = ${ratio.toFixed(2)}:1`);
  process.exit(1);
}

const lines: string[] = [];
for (const [name, steps] of Object.entries(palette)) {
  for (const [step, value] of Object.entries(steps))
    lines.push(`  --color-${name}-${step}: ${value};`);
}
lines.push("");
for (const [name, value] of Object.entries(semantic))
  lines.push(`  --color-${name}: ${value};`);
lines.push("");
for (const [name, value] of Object.entries(fonts))
  lines.push(`  --font-${name}: ${value};`);
lines.push("");
for (const [name, value] of Object.entries(radius))
  lines.push(`  --radius-${name}: ${value};`);
lines.push("");
for (const [name, value] of Object.entries(shadows))
  lines.push(`  --shadow-${name}: ${value};`);

const css = `/* GENERATED from src/tokens.ts by scripts/build.ts — do not edit by hand. */
@theme {
${lines.join("\n")}
}
`;

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(outFile, "utf8");
  } catch {}
  if (current !== css) {
    console.error("theme.css is out of date — run `npm run build:tokens`.");
    process.exit(1);
  }
  console.log("theme.css is up to date; all contrast pairs pass WCAG AA.");
} else {
  writeFileSync(outFile, css);
  console.log(
    `Wrote theme.css; ${contrastPairs.length} contrast pairs pass WCAG AA.`,
  );
}
