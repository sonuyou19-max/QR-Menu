// Copies the demo restaurant's images (supabase/demo/README.md) from the app's /demo/ folder into
// storage, under the demo's folder: logo and cover into `branding`, dish photos into
// `dish-images`. The demo has no members, so nobody can upload them through the app. Only the
// fixed files below, only into the demo's folder; safe to rerun.
import { createClient } from "npm:@supabase/supabase-js@2";

const DEMO_ID = "f65c5a01-3d95-a951-e6fd-c0b3b07a9362";
const SOURCE = "https://app.brisolo.be/demo/";
const STOOFVLEES = "8f19eba6-a560-c8f5-75ed-72e021a38d9a";

/** Source file in app/public/demo/ → bucket and path (the app's own layout for each bucket). */
const FILES: { file: string; bucket: string; path: string; type: string }[] = [
  {
    file: "lindehof-logo.png",
    bucket: "branding",
    path: `${DEMO_ID}/lindehof-logo.png`,
    type: "image/png",
  },
  {
    file: "lindehof-cover.jpg",
    bucket: "branding",
    path: `${DEMO_ID}/lindehof-cover.jpg`,
    type: "image/jpeg",
  },
  {
    file: "dishes/stoofvlees.jpg",
    bucket: "dish-images",
    path: `${DEMO_ID}/${STOOFVLEES}/stoofvlees.jpg`,
    type: "image/jpeg",
  },
  {
    file: "dishes/stoofvlees_thumb.jpg",
    bucket: "dish-images",
    path: `${DEMO_ID}/${STOOFVLEES}/stoofvlees_thumb.jpg`,
    type: "image/jpeg",
  },
];

Deno.serve(async () => {
  const key =
    JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(Deno.env.get("SUPABASE_URL")!, key, {
    auth: { persistSession: false },
  });
  const results: Record<string, string> = {};
  for (const { file, bucket, path, type } of FILES) {
    const res = await fetch(SOURCE + file);
    if (!res.ok || res.headers.get("content-type")?.split(";")[0] !== type) {
      results[file] = `fetch failed (${res.status})`;
      continue;
    }
    const { error } = await db.storage
      .from(bucket)
      .upload(path, await res.arrayBuffer(), {
        contentType: type,
        cacheControl: "31536000",
        upsert: true,
      });
    results[file] = error ? error.message : "ok";
  }
  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
});
