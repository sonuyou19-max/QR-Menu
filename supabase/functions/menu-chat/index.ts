// Guest chat (CLAUDE.md 4.1, 7): a guest asks about one restaurant's published menu. Layers:
// grounding (only that menu, in the guest's language), structured output (dish refs, never free
// prices), server-side checks (_shared/chat-guard.ts), rate limits, and a log of every Q&A.
// The app renders dish cards from its own menu data by id, so names, prices and stock always come
// from the database.
//
// Called anonymously by the guest page (verify_jwt = false).
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@0.135.0/helpers/beta/zod";
import { encodeHex } from "jsr:@std/encoding@1/hex";
import { z } from "npm:zod@4";
import { Anthropic, claudeClient } from "../_shared/claude.ts";
import { adminClient, corsHeaders, json } from "../_shared/http.ts";
import {
  ChatAnswer,
  chatSystemPrompt,
  groundingMenu,
  guard,
  type GuestMenu,
} from "../_shared/chat-guard.ts";

const languageName = (code: string) =>
  code === "zh"
    ? "Chinese (Simplified)"
    : (new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code);

/** Guest chat model (cheaper, faster). Override with the CHAT_MODEL secret. */
const chatModel = Deno.env.get("CHAT_MODEL") || "claude-haiku-4-5-20251001";

const PER_SESSION_PER_DAY = 20;
const PER_IP_PER_HOUR = 60;
const PER_RESTAURANT_PER_DAY = 500;

const Body = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,60}$/),
  language: z.string().regex(/^[a-z]{2}$/),
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  /** The conversation so far, oldest first; the last one is the new question. */
  messages: z
    .array(
      z.object({
        role: z.enum(["guest", "assistant"]),
        text: z.string().trim().min(1).max(500),
      }),
    )
    .min(1)
    .max(12)
    .refine((m) => m.at(-1)!.role === "guest"),
});

async function ipHash(req: Request): Promise<string | null> {
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  if (!ip) return null;
  const salt = Deno.env.get("IP_HASH_SALT") ?? "menubuddy-chat";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${ip}`),
  );
  return encodeHex(new Uint8Array(digest)).slice(0, 32);
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST")
    return json({ ok: false, error: "method" }, 405, cors);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid" }, 400, cors);
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400, cors);
  const { slug, language, sessionId, messages } = parsed.data;

  const db = adminClient();
  // Published menus only (the service role is no member, so drafts return null).
  const { data: menuData } = await db.rpc("get_menu", {
    p_slug: slug,
    p_language: language,
  });
  const menu = menuData as
    (GuestMenu & { restaurant: { slug: string } }) | null;
  if (!menu?.restaurant.is_published)
    return json({ ok: false, error: "not_found" }, 404, cors);
  const { data: restaurant } = await db
    .from("restaurants")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!restaurant) return json({ ok: false, error: "not_found" }, 404, cors);

  const hash = await ipHash(req);
  const day = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const hour = new Date(Date.now() - 3600 * 1000).toISOString();
  const count = (q: ReturnType<typeof db.from>) =>
    q.select("id", { count: "exact", head: true });
  const [bySession, byIp, byRestaurant] = await Promise.all([
    count(db.from("chat_logs"))
      .eq("session_id", sessionId)
      .gte("created_at", day),
    hash
      ? count(db.from("chat_logs")).eq("ip_hash", hash).gte("created_at", hour)
      : Promise.resolve({ count: 0 }),
    count(db.from("chat_logs"))
      .eq("restaurant_id", restaurant.id)
      .gte("created_at", day),
  ]);
  if (
    (bySession.count ?? 0) >= PER_SESSION_PER_DAY ||
    (byIp.count ?? 0) >= PER_IP_PER_HOUR
  )
    return json({ ok: false, error: "limit" }, 429, cors);
  if ((byRestaurant.count ?? 0) >= PER_RESTAURANT_PER_DAY)
    return json({ ok: false, error: "busy" }, 429, cors);

  const language_ = menu.restaurant.language; // what get_menu actually served
  const { refs, json: menuJson } = groundingMenu(menu);
  const system = chatSystemPrompt(
    menu.restaurant.name,
    languageName(language),
    menuJson,
    menu.restaurant.assistant_name,
  );
  const history = messages.slice(-8).map((m) => ({
    role: m.role === "guest" ? ("user" as const) : ("assistant" as const),
    content: m.text,
  }));
  // The API needs the conversation to start with the guest.
  while (history[0]?.role === "assistant") history.shift();
  const question = messages.at(-1)!.text;

  const client = claudeClient({ timeoutMs: 25_000 });
  let answer: ChatAnswer | null = null;
  let tokens = { input: 0, output: 0 };
  // Invalid or missing JSON: one retry, then the fallback line.
  for (let attempt = 0; attempt < 2 && !answer; attempt++) {
    try {
      const response = await client.beta.messages.parse({
        model: chatModel,
        max_tokens: 600,
        temperature: 0.2,
        system: [
          { type: "text", text: system, cache_control: { type: "ephemeral" } },
        ],
        output_config: { format: betaZodOutputFormat(ChatAnswer) },
        messages: history,
      });
      tokens = {
        input: tokens.input + response.usage.input_tokens,
        output: tokens.output + response.usage.output_tokens,
      };
      if (response.stop_reason === "refusal") break;
      answer = response.parsed_output;
    } catch (e) {
      console.error(
        "menu-chat model call failed",
        e instanceof Anthropic.APIError ? e.status : "",
        e,
      );
      if (e instanceof Anthropic.APIError && e.status !== 400) break; // SDK retried already
    }
  }

  if (tokens.input)
    await db.from("usage_events").insert({
      restaurant_id: restaurant.id,
      kind: "chat",
      model: chatModel,
      input_tokens: tokens.input,
      output_tokens: tokens.output,
    });

  const result = answer
    ? guard(answer, refs, menu.restaurant.show_allergens)
    : null;
  await db.from("chat_logs").insert({
    restaurant_id: restaurant.id,
    session_id: sessionId,
    ip_hash: hash,
    language: language_,
    question,
    answer: result?.answer ?? "(fallback: please ask staff)",
    answer_type: result?.answerType ?? "error",
    referenced_item_ids: result?.dishIds ?? [],
  });

  if (!result)
    return json(
      {
        ok: true,
        answer: null,
        dishIds: [],
        answerType: "error",
        notice: null,
      },
      200,
      cors,
    );
  return json(
    {
      ok: true,
      answer: result.answer,
      dishIds: result.dishIds,
      answerType: result.answerType,
      notice: result.notice,
    },
    200,
    cors,
  );
});
