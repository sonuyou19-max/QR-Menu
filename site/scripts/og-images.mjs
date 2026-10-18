// Renders public/og/{nl,fr,en}.png from /og-image/[lang] using the Astro dev server and a local Chrome.
// Usage: npm run og        (uses installed Google Chrome; set CHROME_PATH to use another Chromium)
import { dev } from "astro";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const server = await dev({
  root,
  logLevel: "warn",
  server: { port: 4399 },
  devToolbar: { enabled: false },
});
const browser = await chromium.launch(
  process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : { channel: "chrome" },
);
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
  });
  for (const lang of ["nl", "fr", "en"]) {
    await page.goto(
      `http://localhost:${server.address.port}/og-image/${lang}/`,
      { waitUntil: "networkidle" },
    );
    await page.evaluate(() => document.fonts.ready);
    const path = fileURLToPath(
      new URL(`../public/og/${lang}.png`, import.meta.url),
    );
    await page.screenshot({ path });
    console.log(`Wrote public/og/${lang}.png`);
  }
} finally {
  await browser.close();
  await server.stop();
}
