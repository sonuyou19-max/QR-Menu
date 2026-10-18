// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// Pages that must not appear in the sitemap (they are also `noindex`).
const unlisted = ["/styleguide/", "/menu-demo/"];

export default defineConfig({
  site: process.env.SITE_URL ?? "https://menubuddy.be",
  integrations: [
    react(),
    sitemap({
      filter: (page) =>
        !unlisted.some((path) => new URL(page).pathname.endsWith(path)),
      i18n: {
        defaultLocale: "nl",
        locales: { nl: "nl-BE", fr: "fr-BE", en: "en" },
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
