/** Site-wide settings. Public values only: everything here ends up in the browser. */
export const siteConfig = {
  /** Shown on the legal pages and as the fallback when the form can't be sent. */
  contactEmail: "sonuyou19@gmail.com",
  /** Supabase edge function `book-demo` (project "menubuddy", Frankfurt). */
  bookDemoUrl:
    import.meta.env.PUBLIC_BOOK_DEMO_URL ||
    "https://eoeqtwskfqawxfpuyhac.supabase.co/functions/v1/book-demo",
  /**
   * Cloudflare Turnstile site key. Defaults to Cloudflare's always-pass test key; set the real key
   * here (PUBLIC_TURNSTILE_SITE_KEY) together with TURNSTILE_SECRET_KEY on the function.
   */
  turnstileSiteKey:
    import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA",
  /** Supabase edge function `demo-translate` ("Try with your own menu"). */
  demoTranslateUrl:
    import.meta.env.PUBLIC_DEMO_TRANSLATE_URL ||
    "https://eoeqtwskfqawxfpuyhac.supabase.co/functions/v1/demo-translate",
  /** The product (guest menus + dashboard). Test address until app.menubuddy.be is live. */
  appUrl:
    import.meta.env.PUBLIC_APP_URL || "https://menubuddy-app.sonuyou19.workers.dev",
};

/** The real demo restaurant's guest menu (table 5), opened in the visitor's language. */
export function demoMenuUrl(lang: string): string {
  return `${siteConfig.appUrl}/m/demo?t=5&lang=${lang}`;
}
