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
};
