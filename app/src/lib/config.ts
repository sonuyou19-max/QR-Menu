/** Public settings. Everything here ships to the browser. */
export const config = {
  supabaseUrl:
    import.meta.env.VITE_SUPABASE_URL ||
    "https://eoeqtwskfqawxfpuyhac.supabase.co",
  /** Publishable key: safe in the browser, Row Level Security protects the data. */
  supabaseKey:
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_vkrdzgiRxWrNC1Tl-xYMGA_uFxgulgI",
  /** Final guest-menu address (what printed QR codes point to). */
  menuBase: "app.brisolo.be/m/",
  siteUrl: import.meta.env.VITE_SITE_URL || "https://brisolo.be",
};

/** True on the real domain; on the workers.dev test address menus and QR codes are for testing. */
export const isLiveDomain = location.host === "app.brisolo.be";

/** Guest menu address that works right now (the test address until the domain is live). */
export function menuUrl(slug: string): string {
  return `${location.origin}/m/${slug}`;
}
