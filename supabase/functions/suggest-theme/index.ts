// Buddy suggests a look for the guest menu (CLAUDE.md 4.4, 7): one vision call on the logo,
// cover photo, a page of the printed menu, the dish names and (optionally) the website text.
// Returns the suggestion only; the app applies it with undo.
//
// Deployed with verify_jwt = false: the user's token is checked here.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@0.135.0/helpers/beta/zod";
import { z } from "npm:zod@4";
import {
  Anthropic,
  claudeClient,
  fallbackOptions,
  menuModel,
} from "../_shared/claude.ts";
import {
  adminClient,
  corsHeaders,
  isOwner,
  json,
  requestUser,
} from "../_shared/http.ts";
import { isHex, LookSuggestion, lookSystemPrompt } from "../_shared/look.ts";
import { publicUrl } from "../_shared/website.ts";

/** Suggestions per restaurant per day (usage_events kind 'theme'). */
const MAX_PER_DAY = 15;

const Body = z.object({
  restaurantId: z.uuid(),
  lang: z.enum(["nl", "fr", "en"]).default("nl"),
  website: z.string().trim().max(300).optional(),
  /** Earlier suggestions the owner asked to replace ("Suggest another"). */
  avoid: z
    .array(z.object({ fonts: z.string(), accent: z.string(), template: z.string() }))
    .max(5)
    .default([]),
});

type ImageBlock = Anthropic.Beta.BetaImageBlockParam;
const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

async function image(
  db: SupabaseClient,
  bucket: string,
  path: string | null | undefined,
): Promise<ImageBlock | null> {
  if (!path) return null;
  const { data } = await db.storage.from(bucket).download(path);
  const type = imageTypes.find((t) => t === data?.type);
  if (!data || !type || data.size > 4_000_000) return null;
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: type,
      data: encodeBase64(new Uint8Array(await data.arrayBuffer())),
    },
  };
}

/** Is this a public web address we may fetch (no local or internal hosts)? */
/** Title, description, brand colours and the first visible text of the website's home page. */
async function websiteFacts(raw: string): Promise<string | null> {
  let url = publicUrl(raw);
  try {
    for (let hop = 0; url && hop < 4; hop++) {
      const res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "MenuBuddy look suggestion (+https://menubuddy.be)" },
      });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location");
        await res.body?.cancel();
        url = next ? publicUrl(next, url) : null;
        continue;
      }
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) {
        await res.body?.cancel();
        return null;
      }
      const reader = res.body!.getReader();
      let html = "";
      const decoder = new TextDecoder();
      while (html.length < 400_000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
      }
      await reader.cancel().catch(() => {});
      const meta = (name: string) =>
        html.match(
          new RegExp(
            `<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']{1,300})`,
            "i",
          ),
        )?.[1] ?? null;
      const counts = new Map<string, number>();
      for (const m of html.matchAll(/#([0-9a-f]{6})\b/gi)) {
        const c = `#${m[1]!.toLowerCase()}`;
        if (/^#(f{6}|0{6}|f[0-9a-f]f[0-9a-f]f[0-9a-f]|[0-2][0-9a-f][0-2][0-9a-f][0-2][0-9a-f])$/.test(c))
          continue; // near white / near black
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
      const colours = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([c]) => c);
      const text = html
        .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 1500);
      return JSON.stringify({
        title: html.match(/<title[^>]*>([^<]{1,200})/i)?.[1]?.trim() ?? null,
        description: meta("description") ?? meta("og:description"),
        theme_color: meta("theme-color"),
        frequent_colours: colours,
        text,
      });
    }
  } catch (e) {
    console.error("website fetch failed", e);
  }
  return null;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST")
    return json({ ok: false, error: "method" }, 405, cors);

  const user = await requestUser(req);
  if (!user) return json({ ok: false, error: "auth" }, 401, cors);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid" }, 400, cors);
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400, cors);
  const { restaurantId, lang, website, avoid } = parsed.data;

  const db = adminClient();
  if (!(await isOwner(db, restaurantId, user.id)))
    return json({ ok: false, error: "not_found" }, 404, cors);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ count }, { data: restaurant }, { data: categories }, { data: upload }] =
    await Promise.all([
      db
        .from("usage_events")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .eq("kind", "theme")
        .gte("created_at", since),
      db
        .from("restaurants")
        .select("name, source_language, logo_path, theme")
        .eq("id", restaurantId)
        .single(),
      db
        .from("menu_categories")
        .select("name, sort_order, menu_items(name, image_path, is_hidden)")
        .eq("restaurant_id", restaurantId)
        .order("sort_order"),
      db
        .from("menu_uploads")
        .select("file_paths")
        .eq("restaurant_id", restaurantId)
        .in("status", ["needs_review", "done"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  if ((count ?? 0) >= MAX_PER_DAY)
    return json({ ok: false, error: "rate_limited" }, 429, cors);
  if (!restaurant) return json({ ok: false, error: "not_found" }, 404, cors);

  const ownFile = (p: string | null) =>
    p && p.startsWith(`${restaurantId}/`) && !p.includes("..") ? p : null;
  const theme = (restaurant.theme ?? {}) as { cover_path?: unknown };
  const coverPath = typeof theme.cover_path === "string" ? theme.cover_path : null;
  const dishes = (categories ?? []).flatMap((c) =>
    ((c.menu_items ?? []) as { name: string; image_path: string | null; is_hidden: boolean }[])
      .filter((d) => !d.is_hidden),
  );
  const photoShare = dishes.length
    ? dishes.filter((d) => d.image_path).length / dishes.length
    : 0;

  const [logo, cover, menuPage, site] = await Promise.all([
    image(db, "branding", ownFile(restaurant.logo_path)),
    image(db, "branding", ownFile(coverPath)),
    // Only from this restaurant's own folder (upload rows are owner-editable).
    image(
      db,
      "menu-uploads",
      ((upload?.file_paths as string[] | null) ?? []).find(
        (p) => p.startsWith(`${restaurantId}/`) && !p.includes(".."),
      ),
    ),
    website ? websiteFacts(website) : Promise.resolve(null),
  ]);

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  const add = (label: string, block: ImageBlock | null) => {
    if (!block) return;
    content.push({ type: "text", text: label }, block);
  };
  add("Logo:", logo);
  add("Cover photo:", cover);
  add("A page of the printed menu:", menuPage);
  content.push({
    type: "text",
    text: JSON.stringify({
      restaurant_name: restaurant.name,
      menu_language: restaurant.source_language,
      categories: (categories ?? []).map((c) => c.name).slice(0, 20),
      dishes: dishes.map((d) => d.name).slice(0, 40),
      has_cover_photo: !!cover,
      share_of_dishes_with_photo: Math.round(photoShare * 100) / 100,
      website: site ? JSON.parse(site) : null,
      earlier_suggestions: avoid,
    }),
  });

  try {
    const response = await claudeClient({ timeoutMs: 90_000 }).beta.messages.parse({
      model: menuModel,
      max_tokens: 4000,
      ...fallbackOptions,
      output_config: { effort: "low", format: betaZodOutputFormat(LookSuggestion) },
      system: lookSystemPrompt(restaurant.source_language, lang),
      messages: [{ role: "user", content }],
    });
    await db.from("usage_events").insert({
      restaurant_id: restaurantId,
      kind: "theme",
      model: response.model,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    });
    const s = response.parsed_output;
    if (response.stop_reason === "refusal" || !s)
      return json({ ok: false, error: "no_suggestion" }, 502, cors);

    // Rules the model may miss; the app sanitises again (readTheme).
    const look = {
      ...s,
      accent: isHex(s.accent) ? s.accent.toLowerCase() : "#8c1c13",
      background: isHex(s.background) ? s.background.toLowerCase() : "#fbf7f1",
      header: s.header === "cover" && !cover ? "centered" : s.header,
      layout: s.layout === "photos" && photoShare < 0.5 ? "cards" : s.layout,
      tagline: s.tagline.trim().split(/\s+/).slice(0, 8).join(" ").slice(0, 60),
      vibe: s.vibe.trim().slice(0, 300),
    };
    return json({ ok: true, suggestion: look }, 200, cors);
  } catch (e) {
    console.error(
      "suggest-theme failed",
      e instanceof Anthropic.APIError ? e.status : "",
      e,
    );
    return json({ ok: false, error: "server" }, 502, cors);
  }
});
