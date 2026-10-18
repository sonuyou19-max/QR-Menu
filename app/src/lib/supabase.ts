import { createClient } from "@supabase/supabase-js";
import { config } from "./config";

export const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: {
    // Implicit flow: the login link carries the session itself, so it also works when the
    // email app opens it in a different browser than the one the owner requested it from.
    flowType: "implicit",
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
