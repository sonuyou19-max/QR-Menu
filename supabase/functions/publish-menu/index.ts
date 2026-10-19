// Publishes a restaurant's menu: translates every visible dish and category that has no
// up-to-date translation into each guest language, then marks the restaurant published
// (CLAUDE.md 3, 7, 8).
//
// "Up to date" = translations.source_hash equals the dish's content_hash (kept by a trigger on
// name + descriptions), so only new or changed texts are sent to the AI. Prices, stock and photos
// never need translating.
//
// The owner's app calls this with the restaurant id. We check ownership, claim the job
// (restaurants.translation_status = 'running'), answer 202 and translate in the background: one
// Claude call per language and batch of 25 texts, several in parallel. Each finished batch is
// saved straight away, so a run that is cut off keeps what it did and a retry only does the rest.
//
// Deployed with verify_jwt = false: the user's token is checked here.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
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
import { TranslationBatch } from "../_shared/menu-schema.ts";
import { translationSystemPrompt } from "../_shared/prompts.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const BATCH_SIZE = 25;
const PARALLEL_CALLS = 6;
/** Claude calls per restaurant per day (a full 60-dish menu in 6 languages is ~18). */
const MAX_CALLS_PER_DAY = 200;
/** A run still "running" after this long has died; it may be started again. */
const STALE_AFTER_MS = 5 * 60 * 1000;
/** Background work must end before the platform's 150 s wall-clock limit. */
const BUDGET_MS = 140 * 1000;

const Body = z.object({ restaurantId: z.uuid() });

interface Source {
  entityType: "item" | "category";
  id: string;
  hash: string;
  name: string;
  /** For dishes: the category heading, so short names like "Cheese" under "Naan" make sense. */
  categoryName: string | null;
  menuDescription: string | null;
  typicalDescription: string | null;
}

/** Translate one batch into one language and save it. Returns how many entries were saved. */
async function translateBatch(
  db: SupabaseClient,
  restaurantId: string,
  sourceLanguage: string,
  language: string,
  batch: Source[],
  deadline: number,
): Promise<number> {
  // Short ids ("e0", "e1", …) instead of uuids: fewer tokens, fewer copying mistakes.
  const input = batch.map((s, i) => ({
    id: `e${i}`,
    kind: s.entityType === "item" ? "dish" : "category",
    ...(s.categoryName ? { category: s.categoryName } : {}),
    name: s.name,
    menu_description: s.menuDescription,
    typical_description: s.typicalDescription,
  }));
  for (let attempt = 1; attempt <= 2; attempt++) {
    const timeLeft = deadline - Date.now();
    if (timeLeft < 20_000) return 0;
    try {
      const response = await claudeClient({
        timeoutMs: timeLeft - 5_000,
      }).beta.messages.parse({
        model: menuModel,
        max_tokens: 16000,
        ...fallbackOptions,
        output_config: {
          effort: "low",
          format: betaZodOutputFormat(TranslationBatch),
        },
        system: translationSystemPrompt(sourceLanguage, language),
        messages: [
          { role: "user", content: JSON.stringify({ entries: input }) },
        ],
      });
      await db.from("usage_events").insert({
        restaurant_id: restaurantId,
        kind: "translate",
        model: response.model,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      });
      if (response.stop_reason === "refusal") {
        console.error("Refused", language, response.stop_details);
        return 0;
      }
      const result = response.parsed_output;
      if (!result) {
        console.error("No valid JSON", language, response.stop_reason);
        continue;
      }
      const rows = [];
      for (const entry of result.entries) {
        const index = Number(entry.id.slice(1));
        const source = entry.id.startsWith("e") ? batch[index] : undefined;
        if (!source) continue;
        // A description the menu has must come back translated; otherwise leave it for a retry.
        if (source.menuDescription && !entry.menu_description?.trim()) continue;
        if (source.typicalDescription && !entry.typical_description?.trim())
          continue;
        rows.push({
          restaurant_id: restaurantId,
          entity_type: source.entityType,
          entity_id: source.id,
          language,
          name: entry.name?.trim() || null,
          menu_description: source.menuDescription
            ? entry.menu_description!.trim()
            : null,
          typical_description: source.typicalDescription
            ? entry.typical_description!.trim()
            : null,
          source_hash: source.hash,
        });
      }
      const unique = [...new Map(rows.map((r) => [r.entity_id, r])).values()];
      if (unique.length) {
        const { error } = await db
          .from("translations")
          .upsert(unique, { onConflict: "entity_type,entity_id,language" });
        if (error) throw new Error(error.message);
      }
      return unique.length;
    } catch (e) {
      if (e instanceof Anthropic.APIError) {
        console.error("Claude API error", language, e.status, e.message);
        return 0;
      }
      console.error("Translate batch failed", language, e);
    }
  }
  return 0;
}

/** Run tasks with at most `limit` at a time. */
async function inParallel<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (next < tasks.length) {
        const i = next++;
        results[i] = await tasks[i]!();
      }
    }),
  );
  return results;
}

async function publish(db: SupabaseClient, restaurantId: string) {
  const deadline = Date.now() + BUDGET_MS;
  try {
    const [{ data: restaurant }, cats, items, existing] = await Promise.all([
      db
        .from("restaurants")
        .select("source_language, guest_languages, published_at")
        .eq("id", restaurantId)
        .single(),
      db
        .from("menu_categories")
        .select("id, name, content_hash")
        .eq("restaurant_id", restaurantId),
      db
        .from("menu_items")
        .select(
          "id, category_id, name, menu_description, typical_description, content_hash",
        )
        .eq("restaurant_id", restaurantId)
        .eq("is_hidden", false),
      db
        .from("translations")
        .select("entity_id, language, source_hash")
        .eq("restaurant_id", restaurantId),
    ]);
    if (!restaurant || cats.error || items.error || existing.error)
      throw new Error("load failed");

    const sources: Source[] = [
      ...cats.data.map((c) => ({
        entityType: "category" as const,
        id: c.id,
        hash: c.content_hash,
        name: c.name,
        categoryName: null,
        menuDescription: null,
        typicalDescription: null,
      })),
      ...items.data.map((i) => ({
        entityType: "item" as const,
        id: i.id,
        hash: i.content_hash,
        name: i.name,
        categoryName:
          cats.data.find((c) => c.id === i.category_id)?.name ?? null,
        menuDescription: i.menu_description,
        typicalDescription: i.typical_description,
      })),
    ];
    const done = new Set(
      existing.data.map((t) => `${t.entity_id}:${t.language}:${t.source_hash}`),
    );
    const languages = (restaurant.guest_languages as string[]).filter(
      (l) => l !== restaurant.source_language,
    );

    const tasks: (() => Promise<number>)[] = [];
    let needed = 0;
    for (const language of languages) {
      const missing = sources.filter(
        (s) => !done.has(`${s.id}:${language}:${s.hash}`),
      );
      needed += missing.length;
      for (let i = 0; i < missing.length; i += BATCH_SIZE) {
        const batch = missing.slice(i, i + BATCH_SIZE);
        tasks.push(() =>
          translateBatch(
            db,
            restaurantId,
            restaurant.source_language,
            language,
            batch,
            deadline,
          ),
        );
      }
    }
    const saved = (await inParallel(tasks, PARALLEL_CALLS)).reduce(
      (a, b) => a + b,
      0,
    );

    // The original menu is always complete, so it goes online even if some translations are
    // still missing; guests then see only the original name. The app offers a retry.
    const { error } = await db
      .from("restaurants")
      .update({
        is_published: true,
        published_at: restaurant.published_at ?? new Date().toISOString(),
        translation_status: saved < needed ? "failed" : "idle",
        translation_error: saved < needed ? "partial" : null,
      })
      .eq("id", restaurantId);
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("publish-menu failed", restaurantId, e);
    await db
      .from("restaurants")
      .update({ translation_status: "failed", translation_error: "server" })
      .eq("id", restaurantId);
  }
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
  const { restaurantId } = parsed.data;

  const db = adminClient();
  // Same answer as "doesn't exist": don't reveal other restaurants.
  if (!(await isOwner(db, restaurantId, user.id)))
    return json({ ok: false, error: "not_found" }, 404, cors);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await db
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("kind", "translate")
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_CALLS_PER_DAY)
    return json({ ok: false, error: "rate_limited" }, 429, cors);

  // Claim the job, so a double tap or a second device doesn't run it twice.
  const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const { data: claimed } = await db
    .from("restaurants")
    .update({
      translation_status: "running",
      translation_started_at: new Date().toISOString(),
      translation_error: null,
    })
    .eq("id", restaurantId)
    .or(
      `translation_status.neq.running,translation_started_at.lt.${staleBefore}`,
    )
    .select("id");
  if (!claimed?.length) return json({ ok: true, already: true }, 200, cors);

  EdgeRuntime.waitUntil(publish(db, restaurantId));
  return json({ ok: true }, 202, cors);
});
