// Copies the demo restaurant's images (supabase/demo/README.md) from the app's /demo/ folder into
// the branding bucket, under the demo's folder. The demo has no members, so nobody can upload
// them through the app. Only the fixed files below, only into the demo's folder; safe to rerun.
import { createClient } from "npm:@supabase/supabase-js@2";

const DEMO_ID = "f65c5a01-3d95-a951-e6fd-c0b3b07a9362";
const SOURCE = "https://app.brisolo.be/demo/";
const FILES: Record<string, string> = {
  "lindehof-logo.png": "image/png",
};

Deno.serve(async () => {
  const key =
    JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(Deno.env.get("SUPABASE_URL")!, key, {
    auth: { persistSession: false },
  });
  const results: Record<string, string> = {};
  for (const [file, type] of Object.entries(FILES)) {
    const res = await fetch(SOURCE + file);
    if (!res.ok || res.headers.get("content-type")?.split(";")[0] !== type) {
      results[file] = `fetch failed (${res.status})`;
      continue;
    }
    const { error } = await db.storage
      .from("branding")
      .upload(`${DEMO_ID}/${file}`, await res.arrayBuffer(), {
        contentType: type,
        upsert: true,
      });
    results[file] = error ? error.message : "ok";
  }
  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
});
