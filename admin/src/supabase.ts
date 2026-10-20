import { createClient } from "@supabase/supabase-js";

/** Publishable key: safe in the browser; the database only answers founders (private.founders). */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ||
    "https://eoeqtwskfqawxfpuyhac.supabase.co",
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_vkrdzgiRxWrNC1Tl-xYMGA_uFxgulgI",
  {
    auth: {
      // Implicit flow: the login link carries the session itself, so it works in any phone browser.
      flowType: "implicit",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
