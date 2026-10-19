// "Suggest with AI" for a dish the owner added by hand: typical preparation, confidence, dietary
// flags and allergen suggestions (CLAUDE.md 4). Returns the suggestion only; the app applies it
// through its normal autosave (so it can be undone) and never overwrites confirmed allergens or
// the owner's own description.
//
// Deployed with verify_jwt = false: the user's token is checked here.
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
import { DishSuggestion } from "../_shared/menu-schema.ts";
import { dishSuggestionPrompt } from "../_shared/prompts.ts";

/** Suggestions per restaurant per day (logged as usage_events kind 'extract'). */
const MAX_PER_DAY = 200;

const Body = z.object({ itemId: z.uuid() });

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

  const db = adminClient();
  const { data: item } = await db
    .from("menu_items")
    .select("restaurant_id, name, menu_description, category_id")
    .eq("id", parsed.data.itemId)
    .maybeSingle();
  // Same answer as "doesn't exist": don't reveal other restaurants' dishes.
  if (!item || !(await isOwner(db, item.restaurant_id, user.id)))
    return json({ ok: false, error: "not_found" }, 404, cors);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ count }, { data: restaurant }, { data: category }] =
    await Promise.all([
      db
        .from("usage_events")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", item.restaurant_id)
        .eq("kind", "extract")
        .gte("created_at", since),
      db
        .from("restaurants")
        .select("source_language")
        .eq("id", item.restaurant_id)
        .single(),
      item.category_id
        ? db
            .from("menu_categories")
            .select("name")
            .eq("id", item.category_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  if ((count ?? 0) >= MAX_PER_DAY)
    return json({ ok: false, error: "rate_limited" }, 429, cors);

  try {
    const response = await claudeClient({
      timeoutMs: 60_000,
    }).beta.messages.parse({
      model: menuModel,
      max_tokens: 4000,
      ...fallbackOptions,
      output_config: {
        effort: "low",
        format: betaZodOutputFormat(DishSuggestion),
      },
      system: dishSuggestionPrompt(restaurant?.source_language ?? "en"),
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            name: item.name,
            category: category?.name ?? null,
            description: item.menu_description,
          }),
        },
      ],
    });
    await db.from("usage_events").insert({
      restaurant_id: item.restaurant_id,
      kind: "extract",
      model: response.model,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    });
    const suggestion = response.parsed_output;
    if (response.stop_reason === "refusal" || !suggestion)
      return json({ ok: false, error: "no_suggestion" }, 502, cors);
    return json(
      {
        ok: true,
        suggestion: {
          ...suggestion,
          typical_description: suggestion.typical_description?.trim() || null,
          suggested_allergens: [...new Set(suggestion.suggested_allergens)],
        },
      },
      200,
      cors,
    );
  } catch (e) {
    console.error(
      "suggest-dish failed",
      e instanceof Anthropic.APIError ? e.status : "",
      e,
    );
    return json({ ok: false, error: "server" }, 502, cors);
  }
});
