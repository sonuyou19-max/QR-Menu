// "Try with your own menu" on the marketing site (CLAUDE.md 4.6 Demo B, 7): a visitor sends 1–3
// photos of their menu and a language; Buddy reads and translates them into a preview that is
// never published. Public and costs AI credit, so: honeypot + Turnstile, per-visitor limit
// (hashed IP), a global daily cap, size limits. Photos are never stored; the result is kept in
// demo_runs for 24 hours (pg_cron) and only the visitor holding the run's token can read it.
//
// Two actions: "start" answers right away with a run id + token and works in the background;
// "status" returns the state and, when done, the preview. Deployed with verify_jwt = false.
import { encodeHex } from "jsr:@std/encoding@1/hex";
import { decodeBase64 } from "jsr:@std/encoding@1/base64";
import { betaZodOutputFormat } from "npm:@anthropic-ai/sdk@0.135.0/helpers/beta/zod";
import { z } from "npm:zod@4";
import {
  Anthropic,
  claudeClient,
  fallbackOptions,
  menuModel,
} from "../_shared/claude.ts";
import { adminClient, json } from "../_shared/http.ts";
import { mergePreview, PreviewPage, previewSystemPrompt } from "./preview.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

// Cloudflare's documented always-pass test secret, until TURNSTILE_SECRET_KEY is set (as book-demo).
const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";
const PER_VISITOR_PER_DAY = 3;
/** Global cap on previews per 24 hours (each is ~€0.02–0.05 per photo). */
const MAX_RUNS_PER_DAY = Number(Deno.env.get("DEMO_MAX_RUNS_PER_DAY") ?? 40);
const MAX_PHOTO_BYTES = 2_500_000;
const BUDGET_MS = 140 * 1000;

const languages = [
  "en",
  "fr",
  "nl",
  "de",
  "es",
  "it",
  "pt",
  "pl",
  "zh",
  "ja",
  "ko",
  "ar",
] as const;

const Start = z.object({
  action: z.literal("start"),
  /** JPEG photos, base64 (the site compresses them to max 1600 px first). */
  photos: z.array(z.string().max(3_400_000)).min(1).max(3),
  language: z.enum(languages),
  /** Honeypot: hidden from people, bots fill it in. */
  website: z.string().max(200).optional(),
  turnstileToken: z.string().max(4096),
});
const Status = z.object({
  action: z.literal("status"),
  runId: z.uuid(),
  token: z.string().min(20).max(100),
});

const siteOrigins = (
  Deno.env.get("SITE_ORIGINS") ??
  "https://brisolo.be,https://www.brisolo.be,http://localhost:4321"
).split(",");

function corsHeaders(origin: string | null): Record<string, string> {
  let allowed = false;
  try {
    const host = origin ? new URL(origin).hostname : "";
    allowed =
      origin !== null &&
      (siteOrigins.includes(origin) ||
        (host.endsWith(".workers.dev") && /(^|-)menubuddy-/.test(host)));
  } catch {
    allowed = false;
  }
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": origin! } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    Vary: "Origin",
  };
}

const sha256 = async (text: string) =>
  encodeHex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  );

function clientIp(req: Request): string | null {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

async function verifyTurnstile(token: string, ip: string | null) {
  const form = new FormData();
  form.append(
    "secret",
    Deno.env.get("TURNSTILE_SECRET_KEY") ?? TURNSTILE_TEST_SECRET,
  );
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form },
  );
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

/** Read one photo. Null when it could not be read (after one retry). */
async function readPage(
  /** JPEG, base64. */
  photo: string,
  page: number,
  pages: number,
  language: string,
  deadline: number,
  usage: { input: number; output: number },
): Promise<PreviewPage | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const timeLeft = deadline - Date.now();
    if (timeLeft < 20_000) return null;
    try {
      const response = await claudeClient({
        timeoutMs: timeLeft - 5_000,
      }).beta.messages.parse({
        model: menuModel,
        max_tokens: 16000,
        ...fallbackOptions,
        output_config: {
          effort: "medium",
          format: betaZodOutputFormat(PreviewPage),
        },
        system: previewSystemPrompt(language),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: photo,
                },
              },
              {
                type: "text",
                text:
                  pages === 1
                    ? "This is the menu."
                    : `This is photo ${page} of ${pages} of the same menu, in order. Read only this photo.`,
              },
            ],
          },
        ],
      });
      usage.input += response.usage.input_tokens;
      usage.output += response.usage.output_tokens;
      if (response.stop_reason === "refusal") return null;
      if (response.parsed_output) return response.parsed_output;
    } catch (e) {
      if (e instanceof Anthropic.APIError) {
        console.error("Claude API error", e.status, e.message);
        return null;
      }
      console.error("Invalid result", e);
    }
  }
  return null;
}

async function run(runId: string, photos: string[], language: string) {
  const db = adminClient();
  const deadline = Date.now() + BUDGET_MS;
  const usage = { input: 0, output: 0 };
  try {
    const pages = await Promise.all(
      photos.map((photo, i) =>
        readPage(photo, i + 1, photos.length, language, deadline, usage),
      ),
    );
    const preview = mergePreview(pages, language);
    const failed = preview.categories.length === 0;
    await db
      .from("demo_runs")
      .update({
        status: failed ? "failed" : "done",
        error: failed
          ? pages.every((p) => p !== null && !p.is_menu)
            ? "not_a_menu"
            : "unreadable"
          : null,
        result: failed ? null : preview,
        input_tokens: usage.input,
        output_tokens: usage.output,
      })
      .eq("id", runId);
  } catch (e) {
    console.error("demo-translate failed", runId, e);
    await db
      .from("demo_runs")
      .update({
        status: "failed",
        error: "server",
        input_tokens: usage.input,
        output_tokens: usage.output,
      })
      .eq("id", runId);
  }
  // demo_runs is emptied after 24 h: keep the cost for the founder's monthly AI cost view.
  if (usage.input || usage.output)
    await db.from("usage_events").insert({
      restaurant_id: null,
      kind: "demo",
      model: menuModel,
      input_tokens: usage.input,
      output_tokens: usage.output,
    });
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
  const db = adminClient();

  const status = Status.safeParse(body);
  if (status.success) {
    const { data } = await db
      .from("demo_runs")
      .select("token_hash, status, error, result")
      .eq("id", status.data.runId)
      .maybeSingle();
    // Wrong token or gone (deleted after 24 h): same answer.
    if (!data || data.token_hash !== (await sha256(status.data.token)))
      return json({ ok: false, error: "not_found" }, 404, cors);
    return json(
      { ok: true, status: data.status, error: data.error, result: data.result },
      200,
      cors,
    );
  }

  const parsed = Start.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400, cors);
  const { photos, language, website, turnstileToken } = parsed.data;

  // Bots that fill the hidden field get a normal-looking answer and nothing happens.
  if (website) return json({ ok: false, error: "busy" }, 429, cors);

  const ip = clientIp(req);
  if (!(await verifyTurnstile(turnstileToken, ip)))
    return json({ ok: false, error: "captcha" }, 403, cors);

  let count = 0;
  for (const photo of photos) {
    let bytes: Uint8Array;
    try {
      bytes = decodeBase64(photo);
    } catch {
      return json({ ok: false, error: "invalid" }, 400, cors);
    }
    // JPEG only (starts with FF D8), as the site sends it.
    if (
      bytes.length > MAX_PHOTO_BYTES ||
      bytes[0] !== 0xff ||
      bytes[1] !== 0xd8
    )
      return json({ ok: false, error: "photo" }, 400, cors);
    count++;
  }

  const ipHash = ip
    ? (
        await sha256(
          `${Deno.env.get("IP_HASH_SALT") ?? "menubuddy-demo"}:${ip}`,
        )
      ).slice(0, 32)
    : null;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [mine, all] = await Promise.all([
    ipHash
      ? db
          .from("demo_runs")
          .select("id", { count: "exact", head: true })
          .eq("ip_hash", ipHash)
          .gte("created_at", since)
      : Promise.resolve({ count: 0 }),
    db
      .from("demo_runs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
  ]);
  if ((all.count ?? 0) >= MAX_RUNS_PER_DAY)
    return json({ ok: false, error: "busy" }, 429, cors);
  if ((mine.count ?? 0) >= PER_VISITOR_PER_DAY)
    return json({ ok: false, error: "limit" }, 429, cors);

  const token =
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "");
  const { data: created, error } = await db
    .from("demo_runs")
    .insert({
      token_hash: await sha256(token),
      ip_hash: ipHash,
      photo_count: count,
      target_language: language,
    })
    .select("id")
    .single();
  if (error || !created) return json({ ok: false, error: "server" }, 500, cors);

  EdgeRuntime.waitUntil(run(created.id, photos, language));
  return json({ ok: true, runId: created.id, token }, 202, cors);
});
