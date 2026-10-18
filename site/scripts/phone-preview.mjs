// Packs the built site (dist/) into ONE self-contained HTML file that can be published as a
// private claude.ai Artifact and opened on a phone: CSS and fonts inlined, every page kept as a
// hidden "view", and a tiny router that swaps views when internal links are tapped.
// Usage: npm run build && node scripts/phone-preview.mjs <output.html>
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const out = process.argv[2];
if (!out)
  throw new Error("Usage: node scripts/phone-preview.mjs <output.html>");

const languages = ["nl", "fr", "en"];
const pages = { home: "index.html", demo: "demo/index.html" };
const dir = (lang) => (lang === "nl" ? "" : `${lang}/`);

// CSS with font files inlined as data: URIs.
const cssFile = readdirSync(`${dist}_astro`).find((f) => f.endsWith(".css"));
let css = readFileSync(`${dist}_astro/${cssFile}`, "utf8");
css = css.replace(/url\((\/_astro\/[^)]+\.woff2)\)/g, (_, path) => {
  const data = readFileSync(`${dist}${path.slice(1)}`).toString("base64");
  return `url(data:font/woff2;base64,${data})`;
});

let script = "";
const views = [];
for (const lang of languages) {
  for (const [page, file] of Object.entries(pages)) {
    const html = readFileSync(`${dist}${dir(lang)}${file}`, "utf8");
    let body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
    // Keep one copy of the page scripts (they act on every matching element).
    body = body.replace(
      /<script type="module">([\s\S]*?)<\/script>/g,
      (_, code) => {
        if (!script.includes(code)) script += code;
        return "";
      },
    );
    // Ids repeat across views, so namespace them per view.
    const prefix = `${lang}-${page}-`;
    body = body
      .replace(/ id="([^"]+)"/g, ` id="${prefix}$1"`)
      .replace(/ aria-labelledby="([^"]+)"/g, ` aria-labelledby="${prefix}$1"`);
    views.push(
      `<div data-view="${lang}-${page}" data-lang="${html.match(/<html lang="([^"]+)"/)[1]}" hidden>${body}</div>`,
    );
  }
}

const router = `
const views = [...document.querySelectorAll("[data-view]")];
function show(name, anchor) {
  const view = views.find((v) => v.dataset.view === name) ?? views[0];
  for (const v of views) v.hidden = v !== view;
  document.documentElement.lang = view.dataset.lang;
  const target = anchor && document.getElementById(view.dataset.view + "-" + anchor);
  if (target) target.scrollIntoView();
  else window.scrollTo(0, 0);
  return view;
}
// "/", "/fr/", "/en/demo", "#pricing", "/fr/#faq" → view name + anchor.
function resolve(href, current) {
  const [path, anchor] = href.split("#");
  if (path === "") return [current, anchor];
  const m = path.match(/^\\/(?:(fr|en)\\/?)?(demo)?\\/?$/);
  if (!m) return null;
  return [(m[1] ?? "nl") + "-" + (m[2] ? "demo" : "home"), anchor];
}
let current = show((location.hash.slice(1) || "nl") + "-home");
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[href]");
  if (!a) return;
  const r = resolve(a.getAttribute("href"), current.dataset.view);
  if (!r) return;
  e.preventDefault();
  current = show(r[0], r[1]);
});
`;

const doc = `<title>MenuBuddy Site Preview</title>
<style>${css}
body { background: var(--color-canvas); font-size: 1rem; }
header.sticky { top: env(safe-area-inset-top, 0px); }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 50; background: var(--color-canvas); }
</style>
${views.join("\n")}
<script>${router}</script>
<script type="module">${script}</script>
`;
writeFileSync(out, doc);
console.log(
  `Wrote ${out} (${Math.round(doc.length / 1024)} KB, ${views.length} views)`,
);
