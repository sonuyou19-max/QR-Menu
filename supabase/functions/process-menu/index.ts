// Reads an uploaded menu with Claude vision (CLAUDE.md 3, 5, 7).
//
// The owner's app uploads the photos to Storage (`menu-uploads/<restaurant_id>/<upload_id>/…`),
// inserts a menu_uploads row and calls this function with its id. We check the caller owns the
// restaurant, answer right away (202) and keep working in the background: every photo is read in
// parallel (keeps a long menu inside the time limit), the pages are merged in order, and the result
// lands in menu_uploads.raw_result with status "needs_review". The app polls the row.
//
// Deployed with verify_jwt = false: the user's token is checked here with auth.getUser().
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
import {
  MenuExtraction,
  PageResult,
  type MenuExtraction as Extraction,
} from "../_shared/menu-schema.ts";
import {
  extractionPagePrompt,
  extractionSystemPrompt,
  type NoteLanguage,
} from "../_shared/prompts.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const MAX_FILES = 8;
const MAX_RUNS_PER_DAY = 20;
/** A run still "processing" after this long has died; it may be started again. */
const STALE_AFTER_MS = 5 * 60 * 1000;
/** Background work must end before the platform's 150 s wall-clock limit. */
const BUDGET_MS = 140 * 1000;

const Body = z.object({
  uploadId: z.uuid(),
  /** Dashboard language: notes about unreadable parts are written in it. */
  lang: z.enum(["nl", "fr", "en"]).default("nl"),
});

/** Notes we add ourselves when a whole photo fails. */
const notes = {
  nl: {
    onlyPhoto: "De foto kon niet gelezen worden.",
    photo: "Foto {n} kon niet gelezen worden.",
    notMenu: "Foto {n} lijkt geen menukaart.",
  },
  fr: {
    onlyPhoto: "La photo n'a pas pu être lue.",
    photo: "La photo {n} n'a pas pu être lue.",
    notMenu: "La photo {n} ne ressemble pas à une carte.",
  },
  en: {
    onlyPhoto: "The photo couldn't be read.",
    photo: "Photo {n} couldn't be read.",
    notMenu: "Photo {n} doesn't look like a menu.",
  },
} satisfies Record<NoteLanguage, Record<string, string>>;

type FileBlock =
  Anthropic.Beta.BetaImageBlockParam | Anthropic.Beta.BetaRequestDocumentBlock;

async function loadFile(db: SupabaseClient, path: string): Promise<FileBlock> {
  const { data, error } = await db.storage.from("menu-uploads").download(path);
  if (error || !data) throw new Error(`download ${path}: ${error?.message}`);
  const base64 = encodeBase64(new Uint8Array(await data.arrayBuffer()));
  if (data.type === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: base64 },
    };
  }
  const mediaType = (
    ["image/jpeg", "image/png", "image/webp", "image/gif"] as const
  ).find((t) => t === data.type);
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: mediaType ?? "image/jpeg",
      data: base64,
    },
  };
}

/** Read one photo. Returns null when it could not be read (after one retry). */
async function extractPage(
  ctx: {
    db: SupabaseClient;
    restaurantId: string;
    deadline: number;
    lang: NoteLanguage;
  },
  file: FileBlock,
  page: number,
  pages: number,
): Promise<PageResult | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const timeLeft = ctx.deadline - Date.now();
    if (timeLeft < 20_000) return null;
    const client = claudeClient({ timeoutMs: timeLeft - 5_000 });
    try {
      const response = await client.beta.messages.parse({
        model: menuModel,
        max_tokens: 16000,
        ...fallbackOptions,
        output_config: {
          effort: "medium",
          format: betaZodOutputFormat(PageResult),
        },
        system: extractionSystemPrompt,
        messages: [
          {
            role: "user",
            content: [
              file,
              {
                type: "text",
                text: extractionPagePrompt(page, pages, ctx.lang),
              },
            ],
          },
        ],
      });
      await ctx.db.from("usage_events").insert({
        restaurant_id: ctx.restaurantId,
        kind: "extract",
        model: response.model,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      });
      if (response.stop_reason === "refusal") {
        console.error("Refused", page, response.stop_details);
        return null;
      }
      if (response.parsed_output) return response.parsed_output;
      console.error("No valid JSON", page, response.stop_reason);
    } catch (e) {
      // The SDK already retried rate limits, overloads and network errors.
      if (e instanceof Anthropic.APIError) {
        console.error("Claude API error", page, e.status, e.message);
        return null;
      }
      console.error("Invalid result", page, e);
    }
  }
  return null;
}

function mostCommon(values: string[], fallback: string): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = fallback;
  let bestCount = 0;
  for (const [v, n] of counts) {
    if (n > bestCount) [best, bestCount] = [v, n];
  }
  return best;
}

/** Merge the pages in order and tidy what the model returned (never invents anything). */
function mergePages(
  results: (PageResult | null)[],
  sourceLanguage: string,
  lang: NoteLanguage,
): Extraction {
  const pages = results.filter((r): r is PageResult => r?.is_menu === true);
  const categories: Extraction["categories"] = [];
  const unreadable: string[] = [];

  results.forEach((r, i) => {
    if (r === null) {
      unreadable.push(
        results.length === 1
          ? notes[lang].onlyPhoto
          : notes[lang].photo.replace("{n}", String(i + 1)),
      );
      return;
    }
    if (!r.is_menu) {
      unreadable.push(notes[lang].notMenu.replace("{n}", String(i + 1)));
      return;
    }
    unreadable.push(...r.unreadable_sections);
    r.categories.forEach((cat, j) => {
      const items = cat.items
        .map((item) => {
          const price =
            item.price !== null &&
            Number.isFinite(item.price) &&
            item.price >= 0 &&
            item.price < 100000
              ? Math.round(item.price * 100) / 100
              : null;
          const menuDescription = item.menu_description?.trim() || null;
          return {
            ...item,
            name: item.name.trim(),
            price,
            price_text: item.price_text?.trim() || null,
            menu_description: menuDescription,
            typical_description: menuDescription
              ? null
              : item.typical_description?.trim() || null,
            suggested_allergens: [...new Set(item.suggested_allergens)],
          };
        })
        .filter((item) => item.name.length > 0);
      const name = cat.name.trim();
      const last = categories.at(-1);
      const continues =
        last &&
        j === 0 &&
        (cat.continues_previous_page ||
          !name ||
          name.toLowerCase() === last.name.toLowerCase());
      if (continues) last.items.push(...items);
      else if (items.length > 0 || name)
        categories.push({ name: name || "Menu", items });
    });
  });

  return MenuExtraction.parse({
    restaurant_name:
      pages.find((p) => p.restaurant_name)?.restaurant_name ?? null,
    source_language: mostCommon(
      pages.map((p) => p.source_language.toLowerCase()),
      sourceLanguage,
    ),
    currency: mostCommon(
      pages.map((p) => p.currency.toUpperCase()),
      "EUR",
    ),
    categories: categories.filter((c) => c.items.length > 0),
    unreadable_sections: unreadable,
  });
}

async function processUpload(
  db: SupabaseClient,
  upload: { id: string; restaurant_id: string; file_paths: string[] },
  sourceLanguage: string,
  lang: NoteLanguage,
) {
  const deadline = Date.now() + BUDGET_MS;
  const fail = (error: string) =>
    db
      .from("menu_uploads")
      .update({ status: "failed", error })
      .eq("id", upload.id);
  try {
    const files = await Promise.all(
      upload.file_paths.map((path) => loadFile(db, path)),
    );
    const ctx = { db, restaurantId: upload.restaurant_id, deadline, lang };
    const results = await Promise.all(
      files.map((file, i) => extractPage(ctx, file, i + 1, files.length)),
    );
    const extraction = mergePages(results, sourceLanguage, lang);
    if (extraction.categories.length === 0) {
      const notMenu = results.every((r) => r !== null && !r.is_menu);
      await fail(notMenu ? "not_a_menu" : "unreadable");
      return;
    }
    const { error } = await db
      .from("menu_uploads")
      .update({ status: "needs_review", raw_result: extraction, error: null })
      .eq("id", upload.id);
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("process-menu failed", upload.id, e);
    await fail("server");
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

  const db = adminClient();
  const { data: upload } = await db
    .from("menu_uploads")
    .select("id, restaurant_id, file_paths, status")
    .eq("id", parsed.data.uploadId)
    .maybeSingle();
  if (!upload) return json({ ok: false, error: "not_found" }, 404, cors);

  const [owner, { data: restaurant }] = await Promise.all([
    isOwner(db, upload.restaurant_id, user.id),
    db
      .from("restaurants")
      .select("source_language")
      .eq("id", upload.restaurant_id)
      .single(),
  ]);
  // Same answer as "doesn't exist": don't reveal other restaurants' uploads.
  if (!owner || !restaurant)
    return json({ ok: false, error: "not_found" }, 404, cors);

  // Only files in this restaurant's own folder (the row is owner-editable).
  const paths: string[] = upload.file_paths ?? [];
  if (
    paths.length === 0 ||
    paths.length > MAX_FILES ||
    !paths.every(
      (p) => p.startsWith(`${upload.restaurant_id}/`) && !p.includes(".."),
    )
  ) {
    return json({ ok: false, error: "invalid" }, 400, cors);
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await db
    .from("menu_uploads")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", upload.restaurant_id)
    .gte("processing_started_at", since);
  if ((count ?? 0) >= MAX_RUNS_PER_DAY)
    return json({ ok: false, error: "rate_limited" }, 429, cors);

  // Claim the upload, so a double tap or a second device doesn't pay for a second run.
  const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const { data: claimed } = await db
    .from("menu_uploads")
    .update({
      status: "processing",
      processing_started_at: new Date().toISOString(),
      error: null,
      raw_result: null,
    })
    .eq("id", upload.id)
    .or(
      `processing_started_at.is.null,status.eq.failed,and(status.eq.processing,processing_started_at.lt.${staleBefore})`,
    )
    .select("id");
  if (!claimed?.length) return json({ ok: true, already: true }, 200, cors);

  EdgeRuntime.waitUntil(
    processUpload(
      db,
      { id: upload.id, restaurant_id: upload.restaurant_id, file_paths: paths },
      restaurant.source_language,
      parsed.data.lang,
    ),
  );
  return json({ ok: true }, 202, cors);
});
