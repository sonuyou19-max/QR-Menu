/** Public settings. Everything here ships to the browser. */
export const config = {
  supabaseUrl:
    import.meta.env.VITE_SUPABASE_URL ||
    "https://eoeqtwskfqawxfpuyhac.supabase.co",
  /** Publishable key: safe in the browser, Row Level Security protects the data. */
  supabaseKey:
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_vkrdzgiRxWrNC1Tl-xYMGA_uFxgulgI",
  siteUrl:
    import.meta.env.VITE_SITE_URL ||
    "https://menubuddy-site.sonuyou19.workers.dev",
};
