// Anonymous guest events for the owner's insights (CLAUDE.md 3 owner flow 11, 7): the guest page
// sends small batches (often with navigator.sendBeacon when the page is closed). Published menus
// only; dishes must belong to the restaurant. Nothing personal is stored. A best-effort limit per
// visitor (hashed IP, kept in this instance's memory only) stops a single phone from flooding the
// numbers. Deployed with verify_jwt = false.
import { encodeHex } from "jsr:@std/encoding@1/hex";
import { z } from "npm:zod@4";
import { adminClient } from "../_shared/http.ts";

const MAX_PER_MINUTE = 60;

const Event = z.object({
  kind: z.enum([
    "scan",
    "view_item",
    "language_switch",
    "add_to_cart",
    "show_to_staff",
  ]),
  language: z
    .string()
    .regex(/^[a-z]{2}$/)
    .optional(),
  itemId: z.uuid().optional(),
  table: z
    .string()
    .trim()
    .regex(/^[\p{L}\p{N} -]{1,20}$/u)
    .optional(),
});
const Body = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,60}$/),
  events: z.array(Event).min(1).max(20),
});

const recent = new Map<string, { minute: number; count: number }>();

async function overLimit(req: Request, n: number): Promise<boolean> {
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!ip) return false;
  const key = encodeHex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip)),
    ),
  ).slice(0, 16);
  const minute = Math.floor(Date.now() / 60_000);
  const seen = recent.get(key);
  const count = (seen?.minute === minute ? seen.count : 0) + n;
  recent.set(key, { minute, count });
  if (recent.size > 5000) recent.clear();
  return count > MAX_PER_MINUTE;
}

// Answers carry no data: sendBeacon ignores them, so any origin may send.
const done = (status = 204) =>
  new Response(null, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return done();
  if (req.method !== "POST") return done(405);

  let body: unknown;
  try {
    // sendBeacon sends text/plain, so read the text and parse it ourselves.
    body = JSON.parse(await req.text());
  } catch {
    return done(400);
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return done(400);
  const { slug, events } = parsed.data;
  if (await overLimit(req, events.length)) return done(429);

  const db = adminClient();
  const { data: restaurant } = await db
    .from("restaurants")
    .select("id, is_published")
    .eq("slug", slug)
    .maybeSingle();
  if (!restaurant?.is_published) return done(404);

  // Only dishes of this restaurant: a dish event about an unknown dish is dropped.
  const itemIds = [
    ...new Set(events.flatMap((e) => (e.itemId ? [e.itemId] : []))),
  ];
  const known = new Set<string>();
  if (itemIds.length) {
    const { data } = await db
      .from("menu_items")
      .select("id")
      .eq("restaurant_id", restaurant.id)
      .in("id", itemIds);
    for (const row of data ?? []) known.add(row.id);
  }

  const rows = events
    .filter(
      (e) =>
        !["view_item", "add_to_cart"].includes(e.kind) ||
        (e.itemId && known.has(e.itemId)),
    )
    .map((e) => ({
      restaurant_id: restaurant.id,
      kind: e.kind,
      language: e.language ?? null,
      item_id: e.itemId && known.has(e.itemId) ? e.itemId : null,
      table_label: e.table ?? null,
    }));
  if (rows.length) {
    const { error } = await db.from("guest_events").insert(rows);
    if (error) {
      console.error("track-event insert failed", error.message);
      return done(500);
    }
  }
  return done();
});
